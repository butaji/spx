use std::time::Duration;
use tracing::{info, warn};

use crate::commands::LocalDevice;

pub async fn browse_service(service_type: &str) -> Result<Vec<LocalDevice>, String> {
    let mut devices = Vec::new();

    // Step 1: Browse for instance names
    info!("Browsing {}...", service_type);

    let browse_future = tokio::process::Command::new("dns-sd")
        .args(["-B", service_type, "local"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn dns-sd browse: {}", e))?;

    let browse_result = tokio::time::timeout(Duration::from_secs(5), async {
        let mut child = browse_future;
        // Let it collect responses for 2 seconds
        tokio::time::sleep(Duration::from_secs(2)).await;
        // Kill the process
        let _ = child.kill().await;
        // Read output
        child.wait_with_output().await
    }).await;

    let browse_output: String = match browse_result {
        Ok(Ok(output)) => String::from_utf8_lossy(&output.stdout).into_owned(),
        Ok(Err(e)) => {
            warn!("dns-sd browse for {} timed out or failed: {}", service_type, e);
            return Ok(devices);
        }
        Err(_) => {
            warn!("dns-sd browse for {} timed out after 5 seconds", service_type);
            return Ok(devices);
        }
    };

    // Parse instance names: get last field of lines containing "Add"
    let mut instance_names: Vec<String> = Vec::new();
    for line in browse_output.lines() {
        if line.contains("Add") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(name) = parts.last() {
                if !name.is_empty() && !instance_names.contains(&name.to_string()) {
                    instance_names.push(name.to_string());
                }
            }
        }
    }

    info!("Found {} {} instance(s)", instance_names.len(), service_type);

    // Step 2: Resolve each instance
    for instance_name in instance_names {
        info!("Resolving {}...", instance_name);

        let resolve_future = tokio::process::Command::new("dns-sd")
            .args(["-L", &instance_name, service_type, "local"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn dns-sd resolve: {}", e))?;

        let resolve_result = tokio::time::timeout(Duration::from_secs(5), async {
            let mut child = resolve_future;
            // Let it collect responses for 3 seconds
            tokio::time::sleep(Duration::from_secs(3)).await;
            // Kill the process
            let _ = child.kill().await;
            // Read output
            child.wait_with_output().await
        }).await;

        let resolve_output: String = match resolve_result {
            Ok(Ok(output)) => String::from_utf8_lossy(&output.stdout).into_owned(),
            Ok(Err(e)) => {
                warn!("dns-sd resolve for {} timed out or failed: {}", instance_name, e);
                continue;
            }
            Err(_) => {
                warn!("dns-sd resolve for {} timed out after 5 seconds", instance_name);
                continue;
            }
        };

        // Parse address from "can be reached at" line
        let mut addr = None;
        for line in resolve_output.lines() {
            if line.contains("can be reached at") {
                if let Some(start) = line.find("can be reached at ") {
                    let rest = &line[start + 18..];
                    if let Some(end) = rest.find(" (interface") {
                        addr = Some(rest[..end].to_string());
                    }
                }
            }
        }

        // Parse friendly name from TXT record (fn=...)
        let mut friendly_name = instance_name.clone();
        for line in resolve_output.lines() {
            if let Some(start) = line.find(" fn=") {
                let rest = &line[start + 4..];
                // Parse value: may contain \-escaped spaces
                // Find the value by taking chars until we hit an unescaped space
                let mut name = String::new();
                let mut chars = rest.chars().peekable();
                while let Some(c) = chars.next() {
                    if c == '\\' && chars.peek() == Some(&' ') {
                        // Escaped space - add space and consume it
                        name.push(' ');
                        chars.next();
                    } else if c == ' ' {
                        // Unescaped space = end of value
                        break;
                    } else {
                        name.push(c);
                    }
                }
                if !name.is_empty() {
                    friendly_name = name;
                }
                break;
            }
        }

        if let Some(address) = addr {
            if let Some(colon_pos) = address.rfind(':') {
                let hostname = &address[..colon_pos];
                let port_str = &address[colon_pos + 1..];

                if let Ok(port) = port_str.parse::<u16>() {
                    let device = LocalDevice {
                        name: friendly_name,
                        ip: hostname.to_string(),
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
