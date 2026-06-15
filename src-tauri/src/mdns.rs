use tracing::{info, warn};

use crate::commands::LocalDevice;

/// Parse the instance name from a dns-sd -B "Add" line.
/// Format: `15:26:27.427  Add  3  12 local.  Living Room TV._googlecast._tcp.`
/// The last field is `Living Room TV._googlecast._tcp.` - NO `.local.` suffix on instance name.
fn parse_instance_name(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    let full_name = parts.last()?;

    let stripped = full_name
        .strip_suffix(".local.")
        .or_else(|| full_name.strip_suffix(".local"))
        .unwrap_or(full_name);

    if let Some(dot_underscore_pos) = stripped.find("._") {
        let instance_name = &stripped[..dot_underscore_pos];
        if !instance_name.is_empty() {
            return Some(instance_name.to_string());
        }
    }

    if !stripped.is_empty() {
        return Some(stripped.to_string());
    }

    None
}

/// Run a command with a timeout, capturing stdout.
/// Uses `std::process::Command` in a blocking thread for reliable process control.
/// Run dns-sd with a timeout using the `timeout` binary for reliable process termination.
async fn run_with_timeout(cmd: &str, args: &[&str], timeout_secs: u64) -> Result<String, String> {
    let cmd = cmd.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let result = tokio::task::spawn_blocking(move || {
        use std::process::{Command, Stdio};
        use std::sync::mpsc;
        use std::thread;
        use std::time::Duration;

        let mut child = Command::new(&cmd)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", cmd, e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let (tx, rx) = mpsc::channel();

        thread::spawn(move || {
            let mut output = String::new();
            use std::io::Read;
            let mut reader = std::io::BufReader::new(stdout);
            let mut buf = [0u8; 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => output.push_str(&String::from_utf8_lossy(&buf[..n])),
                    Err(_) => break,
                }
            }
            let _ = tx.send(output);
        });

        // Wait for output or timeout
        match rx.recv_timeout(Duration::from_secs(timeout_secs)) {
            Ok(output) => {
                let _ = child.kill();
                let _ = child.wait();
                Ok(output)
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let _ = child.kill();
                let _ = child.wait();
                thread::sleep(Duration::from_millis(200));
                match rx.try_recv() {
                    Ok(output) => Ok(output),
                    Err(_) => Ok(String::new()),
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                let _ = child.kill();
                let _ = child.wait();
                Ok(String::new())
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result
}

/// Resolve a `.local` hostname to an IPv4 address using `dns-sd -G v4`.
pub async fn resolve_hostname_to_ip(hostname: &str) -> Option<String> {
    let hostname = hostname.trim_end_matches('.');

    let output = match run_with_timeout("dns-sd", &["-G", "v4", hostname], 3).await {
        Ok(o) => o,
        Err(_) => return None,
    };

    for line in output.lines() {
        if line.contains("Add") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                if let Some(ip) = parts.get(parts.len() - 2) {
                    if ip.contains('.') && !ip.ends_with(".local") && !ip.ends_with('.') {
                        return Some(ip.to_string());
                    }
                }
            }
        }
    }

    None
}

pub async fn browse_service(service_type: &str) -> Result<Vec<LocalDevice>, String> {
    let mut devices = Vec::new();

    info!("Browsing {}...", service_type);

    let browse_output = match run_with_timeout("dns-sd", &["-B", service_type, "local"], 10).await {
        Ok(o) => o,
        Err(e) => {
            warn!("dns-sd browse for {} failed: {}", service_type, e);
            return Ok(devices);
        }
    };

    let mut instance_names: Vec<String> = Vec::new();
    for line in browse_output.lines() {
        if line.contains("Add") {
            if let Some(name) = parse_instance_name(line) {
                if !instance_names.contains(&name) {
                    instance_names.push(name);
                }
            }
        }
    }

    info!("Found {} {} instance(s)", instance_names.len(), service_type);

    // Resolve all instances in parallel for speed
    let mut handles = Vec::new();
    for instance_name in instance_names {
        let instance = instance_name.clone();
        let svc = service_type.to_string();
        handles.push(tokio::task::spawn(async move {
            let resolve_output = match run_with_timeout(
                "dns-sd",
                &["-L", &instance, &svc, "local"],
                3,
            ).await {
                Ok(o) => o,
                Err(_) => return None,
            };

            let mut addr = None;
            for line in resolve_output.lines() {
                if line.contains("can be reached at") {
                    if let Some(start) = line.find("can be reached at ") {
                        let rest = &line[start + 18..];
                        if let Some(end) = rest.find(" (interface") {
                            addr = Some(rest[..end].to_string());
                        } else {
                            let trimmed = rest.trim_end();
                            if !trimmed.is_empty() {
                                addr = Some(trimmed.to_string());
                            }
                        }
                    }
                }
            }

            let mut friendly_name = instance.clone();
            for line in resolve_output.lines() {
                if let Some(start) = line.find("fn=") {
                    let rest = &line[start + 3..];
                    let mut name = String::new();
                    let mut chars = rest.chars().peekable();
                    while let Some(c) = chars.next() {
                        if c == '\\' {
                            match chars.peek() {
                                Some(&' ') => { name.push(' '); chars.next(); }
                                Some(&'_') => { name.push('_'); chars.next(); }
                                Some(&'.') => { name.push('.'); chars.next(); }
                                Some(&'\\') => { name.push('\\'); chars.next(); }
                                Some(d) if d.is_ascii_digit() => {
                                    let mut octal = String::new();
                                    let mut count = 0;
                                    while let Some(&nd) = chars.peek() {
                                        if nd.is_ascii_digit() && count < 3 {
                                            octal.push(nd);
                                            chars.next();
                                            count += 1;
                                        } else {
                                            break;
                                        }
                                    }
                                    if let Ok(byte) = u8::from_str_radix(&octal, 8) {
                                        name.push(byte as char);
                                    } else {
                                        name.push('\\');
                                        name.push_str(&octal);
                                    }
                                }
                                Some(c) => { name.push('\\'); name.push(*c); chars.next(); }
                                None => { name.push('\\'); }
                            }
                        } else if c == ' ' {
                            break;
                        } else {
                            name.push(c);
                        }
                    }

                    if name.is_empty() && rest.starts_with('"') {
                        let inner = &rest[1..];
                        if let Some(end) = inner.find('"') {
                            friendly_name = inner[..end].to_string();
                        }
                    } else if !name.is_empty() {
                        friendly_name = name;
                    }
                    break;
                }
            }

            addr.map(|a| (a, friendly_name))
        }));
    }

    for handle in handles {
        if let Ok(Some((address, friendly_name))) = handle.await {
            if let Some(colon_pos) = address.rfind(':') {
                let hostname = &address[..colon_pos];
                let port_str = &address[colon_pos + 1..];

                if let Ok(port) = port_str.parse::<u16>() {
                    let ip = resolve_hostname_to_ip(hostname).await
                        .unwrap_or_else(|| hostname.to_string());

                    let device = LocalDevice {
                        name: friendly_name,
                        ip,
                        port,
                    };
                    info!("  Found device: {} at {}:{}", device.name, device.ip, device.port);
                    devices.push(device);
                }
            }
        }
    }

    Ok(devices)
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Verifies the mDNS scanner can find Cast devices on the local network.
    /// This test is ignored by default because it requires real network hardware.
    #[tokio::test]
    #[ignore]
    async fn test_real_cast_discovery() {
        let devices = browse_service("_googlecast._tcp").await.expect("browse should not fail");
        println!("Found {} Cast device(s):", devices.len());
        for d in &devices {
            println!("  {} at {}:{}", d.name, d.ip, d.port);
        }
        assert!(!devices.is_empty(), "expected at least one Cast device on this network");
    }
}
