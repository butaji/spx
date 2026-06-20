use futures::future::join_all;
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
/// Run a command with a timeout, capturing stdout.
/// Uses the `timeout` binary so the child is guaranteed to be terminated
/// when the deadline expires — critical for `dns-sd -B` which never exits on its own.
async fn run_with_timeout(cmd: &str, args: &[&str], timeout_secs: u64) -> Result<String, String> {
    let cmd = cmd.to_string();
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    tokio::task::spawn_blocking(move || {
        let timeout_bin = if std::path::Path::new("/opt/homebrew/bin/timeout").exists() {
            "/opt/homebrew/bin/timeout"
        } else {
            "timeout"
        };
        let output = std::process::Command::new(timeout_bin)
            .args(["-k", "1", &timeout_secs.to_string(), &cmd])
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .output()
            .map_err(|e| format!("Failed to spawn timeout: {}", e))?;

        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
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

/// Parse a simple key=value pair from a dns-sd TXT line. Used for fields like `id`
/// that do not contain escaped spaces.
fn parse_txt_field(line: &str, key: &str) -> Option<String> {
    for part in line.split_whitespace() {
        if let Some((k, v)) = part.split_once('=') {
            if k == key && !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    None
}

/// Parse the `fn=` friendly name value from a dns-sd TXT line, handling the
/// backslash-escaped encoding used by dns-sd.
fn parse_friendly_name(line: &str) -> Option<String> {
    let start = line.find("fn=")? + 3;
    let rest = &line[start..];
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
            return Some(inner[..end].to_string());
        }
    }

    if name.is_empty() { None } else { Some(name) }
}

pub async fn browse_service(service_type: &str) -> Result<Vec<LocalDevice>, String> {
    let mut devices = Vec::new();

    info!("Browsing {}...", service_type);

    let browse_output = match run_with_timeout("dns-sd", &["-B", service_type, "local"], 12).await {
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

    let service_type_tag = if service_type.contains("googlecast") {
        "googlecast"
    } else if service_type.contains("spotify-connect") {
        "spotify-connect"
    } else {
        service_type
    };

    // Resolve all instances in parallel for speed
    let mut handles = Vec::new();
    for instance_name in instance_names {
        let instance = instance_name.clone();
        let svc = service_type.to_string();
        let tag = service_type_tag.to_string();
        handles.push(tokio::task::spawn(async move {
            let resolve_output = match run_with_timeout(
                "dns-sd",
                &["-L", &instance, &svc, "local"],
                5,
            ).await {
                Ok(o) => o,
                Err(_) => return None,
            };

            let mut addr = None;
            let mut friendly_name = None;
            let mut device_id = None;

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

                if friendly_name.is_none() {
                    friendly_name = parse_friendly_name(line);
                }

                if device_id.is_none() {
                    device_id = parse_txt_field(line, "id");
                }
            }

            let friendly = friendly_name.unwrap_or_else(|| instance.clone());
            addr.map(|a| (a, friendly, device_id, tag))
        }));
    }

    // Await all resolve tasks and collect raw (address, port) pairs.
    // Each handle returns Result<Option<...>, JoinError>; flatten both layers.
    let raw_results: Vec<(String, String, Option<String>, String)> = join_all(handles)
        .await
        .into_iter()
        .filter_map(|r| match r {
            Ok(Some(dev)) => Some(dev),
            _ => None,
        })
        .collect();

    // Parse addresses from the resolve results
    let parsed: Vec<(String, u16, String, Option<String>, String)> = raw_results
        .into_iter()
        .filter_map(|(address, friendly_name, device_id, tag)| {
            let colon_pos = address.rfind(':')?;
            let hostname = address[..colon_pos].to_string();
            let port_str = &address[colon_pos + 1..];
            let port: u16 = port_str.parse::<u16>().ok()?;
            Some((hostname, port, friendly_name, device_id, tag))
        })
        .collect();

    // Parallel hostname → IP lookups (the previous bottleneck — was sequential)
    let ip_futures: Vec<_> = parsed
        .iter()
        .map(|(hostname, _, _, _, _)| resolve_hostname_to_ip(hostname))
        .collect();
    let ip_results: Vec<Option<String>> = join_all(ip_futures).await;

    for ((hostname, port, friendly_name, device_id, tag), ip_opt) in
        parsed.into_iter().zip(ip_results)
    {
        let ip = ip_opt.unwrap_or_else(|| hostname.clone());

        let device = LocalDevice {
            name: friendly_name.clone(),
            friendly_name: Some(friendly_name),
            ip,
            port,
            service_type: Some(tag.to_string()),
            id: device_id,
        };
        info!(
            "  Found device: {} ({}) at {}:{}",
            device.name,
            tag,
            device.ip,
            device.port
        );
        devices.push(device);
    }

    Ok(devices)
}

#[cfg(test)]
mod parsing_tests {
    use super::*;

    // ── parse_instance_name ─────────────────────────────────────────────────────
    //
    // dns-sd output has fixed-width columns separated by whitespace.
    // The instance name is always the LAST field (real names have no spaces).
    // Real example: `12:43:44.185  Add        3  15 local.  _googlecast._tcp.  Google-Nest-Mini-...`
    // Splitting by whitespace: ["12:43:44.185", "Add", "3", "15", "local.", "_googlecast._tcp.", "Google-Nest-Mini-..."]
    // Last field = "Google-Nest-Mini-..." → strip "._googlecast._tcp." → "Google-Nest-Mini-..."

    #[test]
    fn parse_instance_name_real_format() {
        // Tab-separated columns like real dns-sd output (tabs are whitespace → same split)
        let line = "12:43:44.185\tAdd\t3\t15\tlocal.\t_googlecast._tcp.\tGoogle-Nest-Mini-abc123";
        assert_eq!(
            parse_instance_name(line),
            Some("Google-Nest-Mini-abc123".to_string())
        );
    }

    #[test]
    fn parse_instance_name_strips_service_suffix() {
        // _googlecast._tcp. is the service type field; instance name is BEFORE it
        let line = "Add  0  0 local.  _spotify-connect._tcp.  Spotify-Connect-ABC123";
        assert_eq!(
            parse_instance_name(line),
            Some("Spotify-Connect-ABC123".to_string())
        );
    }

    #[test]
    fn parse_instance_name_strips_local_dot() {
        // .local. is the domain field; instance name comes after it
        let line = "12:00.000  Add  0  0 local.  _googlecast._tcp.  Nest-Mini-xyz789";
        assert_eq!(
            parse_instance_name(line),
            Some("Nest-Mini-xyz789".to_string())
        );
    }

    #[test]
    fn parse_instance_name_single_word() {
        let line = "11:11:11.111  Add  1  1 local.  _googlecast._tcp.  Mini2";
        assert_eq!(parse_instance_name(line), Some("Mini2".to_string()));
    }

    #[test]
    fn parse_instance_name_no_service_suffix_still_extracts() {
        // When last field has no "._" delimiter, the whole field is returned.
        // This shouldn't happen with real dns-sd output, but the parser handles it.
        let line = "11:11:11.111  Add  1  1 local.  _googlecast._tcp.";
        // The parser finds "._" in "_googlecast._tcp." → strips after "._"
        // Actually it strips the whole "._..." suffix:
        let parts: Vec<&str> = line.split_whitespace().collect();
        let full_name = parts.last().unwrap();
        let stripped = full_name.strip_suffix(".local.").or_else(|| full_name.strip_suffix(".local")).unwrap_or(full_name);
        // Now stripped = "_googlecast._tcp."
        // The function finds "._" and returns the part before it
        assert_eq!(parse_instance_name(line), Some("_googlecast".to_string()));
    }

    #[test]
    fn parse_instance_name_trailing_local_returns_field() {
        // "local." has no "._" delimiter, so the parser falls through and returns
        // the entire last field (which happens to be "local." here — an edge case
        // that wouldn't occur with real dns-sd output).
        let line = "11:11:11.111  Add  1  1 local.";
        // strip_suffix(".local.") = None, strip_suffix(".local") = None → stripped = "local."
        // "._" not found → !is_empty() = true → returns Some("local.")
        assert_eq!(parse_instance_name(line), Some("local.".to_string()));
    }

    #[test]
    fn parse_instance_name_real_nest_mini() {
        // Real device name from the network
        let line = "12:43:44.185\tAdd\t3\t15\tlocal.\t_googlecast._tcp.\tGoogle-Nest-Mini-8018270c713a8367f23959bcf6daa580";
        assert_eq!(
            parse_instance_name(line),
            Some("Google-Nest-Mini-8018270c713a8367f23959bcf6daa580".to_string())
        );
    }

    // ── parse_txt_field ───────────────────────────────────────────────────────
    // TXT records are key=value pairs separated by whitespace.
    // Simple field: id=abc123  (no escaped spaces in the value)

    #[test]
    fn parse_txt_field_id() {
        let line = "txtvers=1 md=.. id=8018270c713a8367f23959bcf6daa580";
        assert_eq!(
            parse_txt_field(line, "id"),
            Some("8018270c713a8367f23959bcf6daa580".to_string())
        );
    }

    #[test]
    fn parse_txt_field_multiple_fields() {
        let line = "txtvers=1 md=Google\040Nest\040Mini ic=/icon.png fn=Living\040Room\040speaker id=abc123";
        // parse_txt_field is for simple fields (no escape handling) — it returns first token
        assert_eq!(parse_txt_field(line, "txtvers"), Some("1".to_string()));
        assert_eq!(parse_txt_field(line, "id"), Some("abc123".to_string()));
    }

    #[test]
    fn parse_txt_field_missing_key() {
        let line = "txtvers=1 md=.. ca=4096";
        assert_eq!(parse_txt_field(line, "id"), None);
    }

    #[test]
    fn parse_txt_field_empty_value() {
        let line = "txtvers=1 id=";
        assert_eq!(parse_txt_field(line, "id"), None);
    }

    #[test]
    fn parse_txt_field_underscore_in_key() {
        let line = "device_type=Speaker id=d7b9d4c1ef58a1f3";
        assert_eq!(parse_txt_field(line, "device_type"), Some("Speaker".to_string()));
    }

    // ── parse_friendly_name ────────────────────────────────────────────────────
    //
    // dns-sd encodes special chars in TXT records with backslash escapes:
    //   \040 = space, \_ = underscore, \. = period, \\ = backslash
    // In Rust string literals, we write \\ to get a single \ in the string,
    // and \040 for the octal escape (decimal 32 = 0x20 = space).
    //
    // Real example: `fn=Living\040Room\040speaker` → "Living Room speaker"

    #[test]
    fn parse_friendly_name_simple() {
        // fn= followed by a name without special chars
        let line = "txtvers=1 md=.. fn=LivingRoomSpeaker id=abc";
        assert_eq!(parse_friendly_name(line), Some("LivingRoomSpeaker".to_string()));
    }

    #[test]
    fn parse_friendly_name_quoted_not_supported() {
        // The parser treats '"' as a regular character (not a quote delimiter),
        // so `fn="Bedroom Display"` reads up to the first space:
        let line = r#"txtvers=1 fn="Bedroom Display" id=abc"#;
        // Parser sees: '"' → add to name, 'B' → add, ... ' ' → stop
        // Result: '"' + "Bedroom" = '"'Bedroom'
        assert_eq!(parse_friendly_name(line), Some("\"Bedroom".to_string()));
        // Real dns-sd devices use escaped spaces (\040) not quotes — see parse_friendly_name_real_nest_mini
    }

    #[test]
    fn parse_friendly_name_octal_space() {
        // \040 in dns-sd = space (ASCII 32 = 0x20 = octal 040)
        // In Rust: "\\040" in the source → "\" + "040" in the string
        //           → parser sees "\" + "040" → octal 040 → char 32 → space
        let line = "txtvers=1 md=.. fn=Living\\040Room\\040TV id=DEV123";
        assert_eq!(parse_friendly_name(line), Some("Living Room TV".to_string()));
    }

    #[test]
    fn parse_friendly_name_octal_underscore() {
        // \_ = literal underscore (ASCII 95 = 0x5F = octal 137)
        // In Rust: "\\_" → "\" + "_" in string → parser sees "\_" → returns "_"
        let line = "txtvers=1 md=.. fn=Bedroom\\_Office\\_Speaker";
        assert_eq!(parse_friendly_name(line), Some("Bedroom_Office_Speaker".to_string()));
    }

    #[test]
    fn parse_friendly_name_octal_dot() {
        // \. = literal period (ASCII 46 = octal 056)
        let line = r#"txtvers=1 md=.. fn=Living\056Room\056TV"#;
        assert_eq!(parse_friendly_name(line), Some("Living.Room.TV".to_string()));
    }

    #[test]
    fn parse_friendly_name_double_backslash() {
        // \\ = literal backslash
        let line = r#"txtvers=1 md=.. fn=Office\\Server"#;
        assert_eq!(parse_friendly_name(line), Some(r"Office\Server".to_string()));
    }

    #[test]
    fn parse_friendly_name_missing() {
        let line = "txtvers=1 md=.. ca=4096";
        assert_eq!(parse_friendly_name(line), None);
    }

    #[test]
    fn parse_friendly_name_empty_fn() {
        let line = "txtvers=1 fn=";
        assert_eq!(parse_friendly_name(line), None);
    }

    #[test]
    fn parse_friendly_name_real_nest_mini() {
        // Real device from the network
        let line = r#"txtvers=1 md=Google\040Nest\040Mini ic=/setup/icon.png fn=Living\040Room\040speaker ca=198660"#;
        assert_eq!(parse_friendly_name(line), Some("Living Room speaker".to_string()));
    }
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
