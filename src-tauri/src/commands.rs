use crate::mdns::browse_service;
use std::collections::HashSet;
use std::str::FromStr;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;
use tracing::{info, debug, warn};
use std::process::Command;

#[tauri::command]
pub fn is_mock_mode() -> bool {
    std::env::var("SPX_MOCK").unwrap_or_default() == "1"
        || std::env::var("VITE_SPX_MOCK").unwrap_or_default() == "1"
}

/// Check if Spotify credentials are properly configured.
/// Returns detailed status for the frontend to display.
#[tauri::command]
pub fn check_credentials_status() -> Result<serde_json::Value, String> {
    debug!("Checking credentials status");

    let client_id_result = std::env::var("SPOTIFY_CLIENT_ID")
        .or_else(|_| std::env::var("VITE_SPOTIFY_CLIENT_ID"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let client_secret_result = std::env::var("SPOTIFY_CLIENT_SECRET")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let (client_id_status, client_id_value) = match client_id_result {
        Some(id) if id == "your_client_id_here" => (
            "placeholder",
            "Contains placeholder value 'your_client_id_here'".to_string(),
        ),
        Some(id) => ("ok", id),
        None => ("missing", "Not set".to_string()),
    };

    let (client_secret_status, client_secret_value) = match client_secret_result {
        Some(secret) if secret == "your_client_secret_here" => (
            "placeholder",
            "Contains placeholder value 'your_client_secret_here'".to_string(),
        ),
        Some(_) => ("ok", "[SET]".to_string()),
        None => ("missing", "Not set".to_string()),
    };

    let configured = client_id_status == "ok"
        && client_secret_status == "ok"
        && client_id_value != "your_client_id_here";

    Ok(serde_json::json!({
        "configured": configured,
        "clientId": {
            "status": client_id_status,
            "value": if client_id_status == "ok" { "[CONFIGURED]" } else { &client_id_value }
        },
        "clientSecret": {
            "status": client_secret_status,
            "value": client_secret_value
        },
        "instructions": if !configured {
            Some({
                let id_hint = if client_id_status == "missing" {
                    "SPOTIFY_CLIENT_ID is not set"
                } else {
                    "SPOTIFY_CLIENT_ID contains placeholder"
                };
                let secret_hint = if client_secret_status == "missing" {
                    "SPOTIFY_CLIENT_SECRET is not set"
                } else {
                    "SPOTIFY_CLIENT_SECRET contains placeholder"
                };
                format!(
                    "{}\n{}\n\nFix: Edit the .env file in the project root:\n\
                    SPOTIFY_CLIENT_ID=<your_real_client_id>\n\
                    SPOTIFY_CLIENT_SECRET=<your_real_client_secret>\n\n\
                    Get credentials from: https://developer.spotify.com/dashboard",
                    id_hint, secret_hint
                )
            })
        } else {
            None
        }
    }))
}

#[tauri::command]
pub fn get_spotify_client_id() -> Result<String, String> {
    debug!("get_spotify_client_id called");
    if is_mock_mode() {
        debug!("Mock mode: returning mock client ID");
        return Ok("mock_client_id".to_string());
    }

    // Try env vars first
    if let Ok(id) = std::env::var("SPOTIFY_CLIENT_ID") {
        let id = id.trim();
        if !id.is_empty() && id != "your_client_id_here" {
            return Ok(id.to_string());
        }
        if id == "your_client_id_here" {
            return Err(
                "SPOTIFY_CLIENT_ID contains placeholder 'your_client_id_here'.\n\n\
                Get your real Client ID from https://developer.spotify.com/dashboard\n\
                and update the .env file.".to_string()
            );
        }
    }
    if let Ok(id) = std::env::var("VITE_SPOTIFY_CLIENT_ID") {
        let id = id.trim();
        if !id.is_empty() && id != "your_client_id_here" {
            return Ok(id.to_string());
        }
    }

    // Try bundled config file (Resources is at Contents/Resources, not MacOS/Resources)
    if let Ok(exe_path) = std::env::current_exe() {
        // Standard bundled app: Contents/Resources/
        if let Some(contents_dir) = exe_path.parent().and_then(|p| p.parent()) {
            let config_path = contents_dir.join("Resources/spx_client_id.txt");
            if let Ok(id) = std::fs::read_to_string(&config_path) {
                let id = id.trim().to_string();
                if !id.is_empty() && id != "your_client_id_here" {
                    debug!("Loaded client ID from bundle config: {:?}", config_path);
                    return Ok(id);
                }
            }
        }
        // Fallback: try MacOS/Resources for dev builds
        if let Some(mac_dir) = exe_path.parent() {
            let dev_path = mac_dir.join("Resources/spx_client_id.txt");
            if let Ok(id) = std::fs::read_to_string(&dev_path) {
                let id = id.trim().to_string();
                if !id.is_empty() && id != "your_client_id_here" {
                    debug!("Loaded client ID from dev config: {:?}", dev_path);
                    return Ok(id);
                }
            }
        }
    }

    Err(
        "Spotify Client ID not configured.\n\n\
        Go to https://developer.spotify.com/dashboard to get your Client ID,\n\
        then add it to the .env file:\n\n\
        SPOTIFY_CLIENT_ID=YOUR_CLIENT_ID\n\
        SPOTIFY_CLIENT_SECRET=YOUR_CLIENT_SECRET\n\n\
        Then restart the app.".to_string()
    )
}

#[tauri::command]
pub async fn start_callback_server(expected_state: Option<String>) -> Result<Option<(String, String)>, String> {
    info!("Starting OAuth callback server on 127.0.0.1:1422");
    let listener = TcpListener::bind("127.0.0.1:1422").await
        .map_err(|e| e.to_string())?;
    debug!("Callback server bound successfully");

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        async {
            loop {
                let (mut socket, _) = listener.accept().await.map_err(|e| e.to_string())?;
                let mut buf = [0u8; 4096];
                let n = match socket.read(&mut buf).await {
                    Ok(n) => n,
                    Err(e) => {
                        debug!("Failed to read callback request: {}", e);
                        continue;
                    }
                };
                if n == 0 {
                    continue;
                }
                let request = String::from_utf8_lossy(&buf[..n]);
                debug!("Parsed request: {}", request);

                // Only handle GET /callback?... requests; reject probes/other paths.
                let callback_line = request.lines().find(|l| l.starts_with("GET /callback?"));
                let Some(line) = callback_line else {
                    let body = "<html><body><h1>Not Found</h1></body></html>";
                    let response = format!(
                        "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(), body
                    );
                    let _ = socket.write_all(response.as_bytes()).await;
                    let _ = socket.flush().await;
                    continue;
                };

                let query = line.split(' ').nth(1).unwrap_or("").trim_start_matches("/callback?");
                let mut code = None;
                let mut state = None;
                let mut error = None;
                for param in query.split('&') {
                    let mut parts = param.splitn(2, '=');
                    if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                        let decoded = urlencoding::decode(value).unwrap_or_default().to_string();
                        match key {
                            "code" => {
                                code = Some(decoded);
                                debug!("Found auth code in callback");
                            }
                            "state" => {
                                state = Some(decoded);
                                debug!("Found state in callback");
                            }
                            "error" => {
                                error = Some(decoded);
                                debug!("Found error in callback");
                            }
                            _ => {}
                        }
                    }
                }

                if let Some(err) = error {
                    let body = format!("<html><body style='font-family:sans-serif;padding:40px'><h1 style='color:#e53935'>Authentication Failed</h1><p style='color:#666'>Error: {}</p><p style='margin-top:20px'>This window will not close automatically.<br>Return to the SPX app to see the error details.</p></body></html>", err);
                    let response = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(), body
                    );
                    let _ = socket.write_all(response.as_bytes()).await;
                    let _ = socket.flush().await;
                    return Err(format!("Spotify auth error: {}", err));
                }

                // Validate state if caller provided one.
                if let Some(expected) = expected_state {
                    if state.as_ref() != Some(&expected) {
                        let body = "<html><body style='font-family:sans-serif;padding:40px'><h1 style='color:#e53935'>Authentication Failed</h1><p style='color:#666'>Invalid state parameter. Please try signing in again.</p><p style='margin-top:20px'>Return to the SPX app to retry.</p></body></html>";
                        let response = format!(
                            "HTTP/1.1 403 Forbidden\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            body.len(), body
                        );
                        let _ = socket.write_all(response.as_bytes()).await;
                        let _ = socket.flush().await;
                        return Err("OAuth state mismatch".to_string());
                    }
                }

                let body = if code.is_some() {
                    "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h1 style='color:#4caf50'>Authentication Successful!</h1><p style='color:#666'>You can close this window and return to SPX.</p><script>setTimeout(function() { window.close(); }, 1500);</script></body></html>"
                } else {
                    "<html><body style='font-family:sans-serif;padding:40px'><h1 style='color:#e53935'>Authentication Failed</h1><p style='color:#666'>No authorization code received.</p><p style='margin-top:20px'>Return to the SPX app and try again.</p></body></html>"
                };

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.flush().await;

                return Ok::<_, String>((code, state));
            }
        }
    ).await;

    match result {
        Ok(Ok((Some(code), state))) => Ok(Some((code, state.unwrap_or_default()))),
        Ok(Ok((None, _))) => Ok(None),
        Ok(Err(e)) => Err(e),
        Err(_) => {
            info!("Callback server timed out");
            Err("Callback server timeout".to_string())
        }
    }
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct LocalDevice {
    pub name: String,
    pub ip: String,
    pub port: u16,
}

#[tauri::command]
pub async fn scan_spotify_devices() -> Result<Vec<LocalDevice>, String> {
    tracing::info!("Starting parallel mDNS scan for audio devices...");

    let cast_future = browse_service("_googlecast._tcp");
    let spotify_future = browse_service("_spotify-connect._tcp");

    let (cast_result, spotify_result) = tokio::join!(cast_future, spotify_future);

    info!("Cast result: {:?}", cast_result);
    info!("Spotify result: {:?}", spotify_result);

    let mut devices: Vec<LocalDevice> = Vec::new();
    let mut seen: HashSet<(String, String)> = HashSet::new();

    match cast_result {
        Ok(cast_devices) => {
            tracing::info!("Google Cast scan found {} device(s)", cast_devices.len());
            for device in cast_devices {
                let key = (device.name.clone(), device.ip.clone());
                if !seen.contains(&key) {
                    seen.insert(key);
                    devices.push(device);
                }
            }
        }
        Err(e) => tracing::warn!("Google Cast scan error: {}", e),
    }

    match spotify_result {
        Ok(spotify_devices) => {
            tracing::info!("Spotify Connect scan found {} device(s)", spotify_devices.len());
            for device in spotify_devices {
                let key = (device.name.clone(), device.ip.clone());
                if !seen.contains(&key) {
                    seen.insert(key);
                    devices.push(device);
                }
            }
        }
        Err(e) => tracing::warn!("Spotify Connect scan error: {}", e),
    }

    tracing::info!("Total unique devices found: {}", devices.len());
    Ok(devices)
}

#[tauri::command]
pub async fn wake_cast_device(ip: String) -> Result<String, String> {
    info!("Waking Cast device at {}", ip);

    // Validate IP
    if ip.ends_with(".local") || ip.ends_with(".local.") {
        return Err(format!("Cannot wake device: hostname '{}' must be resolved to an IP first.", ip));
    }

    // Step 1: Pre-check — is port 8009 reachable?
    let addr = format!("{}:8009", ip);
    match timeout(Duration::from_secs(3), TcpStream::connect(&addr)).await {
        Ok(Ok(_)) => info!("Port 8009 is reachable on {}", ip),
        Ok(Err(e)) => {
            warn!("Port 8009 not reachable on {}: {}", ip, e);
            return Err(format!("Device at {} is not responding on port 8009. Please make sure it's powered on and connected to the same network.", ip));
        }
        Err(_) => {
            warn!("TCP connect to {} timed out after 3s", addr);
            return Err(format!("Device at {} timed out. Please make sure it's powered on and connected to the same network.", ip));
        }
    }

    // Step 2: Launch Spotify via Cast V2
    match wake_cast_v2(&ip).await {
        Ok(result) => {
            info!("Cast device woken successfully: {}", result);
            Ok(result)
        }
        Err(e) => {
            warn!("Cast V2 wake failed: {}", e);
            Err(e)
        }
    }
}

async fn wake_cast_v2(ip: &str) -> Result<String, String> {
    let ip_owned = ip.to_string();

    // rust_cast does blocking I/O, so run it in spawn_blocking
    let result = tokio::task::spawn_blocking(move || {
        // Connect with rust_cast (TLS on port 8009)
        let cast_device = rust_cast::CastDevice::connect_without_host_verification(&ip_owned, 8009)
            .map_err(|e| format!("Cast V2 connect failed: {}", e))?;

        // Step 1: Send CONNECT message (required before any other commands)
        cast_device.connection.connect("receiver-0")
            .map_err(|e| format!("Cast V2 CONNECT failed: {}", e))?;

        // Step 2: Check if Spotify is already running
        let status = cast_device.receiver.get_status()
            .map_err(|e| format!("Cast V2 get_status failed: {}", e))?;

        let spotify_app_ids = ["CC32E753", "705D30C6", "531A4F84", "CC320225"];
        let spotify_running = status.applications.iter().any(|app| {
            spotify_app_ids.contains(&app.app_id.as_str()) || app.display_name.to_lowercase().contains("spotify")
        });

        if spotify_running {
            return Ok("Spotify is already running on this device".to_string());
        }

        // Step 3: Try to launch Spotify (may fail with NOT_FOUND on some devices)
        let spotify_app = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753")
            .or_else(|_| rust_cast::channels::receiver::CastDeviceApp::from_str("705D30C6"))
            .or_else(|_| rust_cast::channels::receiver::CastDeviceApp::from_str("531A4F84"))
            .or_else(|_| rust_cast::channels::receiver::CastDeviceApp::from_str("CC320225"))
            .map_err(|_| "Invalid app ID".to_string())?;

        match cast_device.receiver.launch_app(&spotify_app) {
            Ok(app) => Ok(format!("Spotify app launched via Cast V2: {:?}", app)),
            Err(e) => {
                let msg = format!("{}", e);
                if msg.contains("NOT_FOUND") {
                    Err("Spotify is not running on this device. Please open the Spotify app on your Cast device and try again.".to_string())
                } else {
                    Err(format!("Cast V2 launch failed: {}", e))
                }
            }
        }
    });

    // Wrap in a 10-second timeout
    match timeout(Duration::from_secs(10), result).await {
        Ok(Ok(Ok(s))) => Ok(s),
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err("Cast V2 wake task panicked".to_string()),
        Err(_) => Err("Cast V2 wake timed out after 10 seconds".to_string()),
    }
}

#[tauri::command]
pub async fn authenticate_cast_device_command(
    ip: String,
    access_token: String,
    device_name: String,
) -> Result<String, String> {
    info!("Authenticating Cast device {} at {}", device_name, ip);

    let ip_owned = ip;
    let token_owned = access_token;
    let name_owned = device_name;

    let result = tokio::task::spawn_blocking(move || {
        crate::spotify_cast::authenticate_cast_device(
            &ip_owned,
            &token_owned,
            &name_owned,
        )
    });

    // Wrap in a 30-second timeout
    match timeout(Duration::from_secs(30), result).await {
        Ok(Ok(Ok(s))) => Ok(s),
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err("Cast auth task panicked".to_string()),
        Err(_) => Err("Cast auth timed out after 30 seconds".to_string()),
    }
}

#[tauri::command]
pub async fn authenticate_cast_device_raw_command(
    ip: String,
    access_token: String,
) -> Result<String, String> {
    info!("Authenticating Cast device at {} using raw protocol", ip);

    let ip_owned = ip;
    let token_owned = access_token;

    let result = tokio::task::spawn_blocking(move || {
        crate::cast_raw_auth::authenticate_cast_device_raw(
            &ip_owned,
            &token_owned,
        )
    });

    // Wrap in a 45-second timeout
    match timeout(Duration::from_secs(45), result).await {
        Ok(Ok(Ok(s))) => Ok(s),
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err("Raw Cast auth task panicked".to_string()),
        Err(_) => Err("Raw Cast auth timed out after 45 seconds".to_string()),
    }
}

#[tauri::command]
pub async fn diagnose_network(ip: String) -> Result<String, String> {
    let mut results = vec![format!("Network diagnostics for {}\n", ip)];

    // Test 1: Basic TCP connection from Rust
    results.push("Test 1: Rust TCP connection".to_string());
    match timeout(Duration::from_secs(5), TcpStream::connect(format!("{}:8009", ip))).await {
        Ok(Ok(_)) => results.push("  ✅ TCP connect succeeded".to_string()),
        Ok(Err(e)) => results.push(format!("  ❌ TCP connect failed: {}", e)),
        Err(_) => results.push("  ❌ TCP connect timed out".to_string()),
    }

    // Test 2: Ping via system command
    results.push("\nTest 2: System ping".to_string());
    match Command::new("ping").args(["-c", "2", "-W", "2", &ip]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            if output.status.success() {
                results.push("  ✅ Ping succeeded".to_string());
            } else {
                results.push(format!("  ❌ Ping failed: {}", stderr));
            }
            results.push(format!("  stdout: {}", stdout.lines().next().unwrap_or("")));
        }
        Err(e) => results.push(format!("  ❌ Ping command failed: {}", e)),
    }

    // Test 3: DNS resolution
    results.push("\nTest 3: DNS resolution".to_string());
    match tokio::net::lookup_host(format!("{}:8009", ip)).await {
        Ok(addrs) => {
            let addrs: Vec<_> = addrs.collect();
            results.push(format!("  ✅ Resolved to {:?}", addrs));
        }
        Err(e) => results.push(format!("  ❌ DNS failed: {}", e)),
    }

    // Test 4: Check local interfaces
    results.push("\nTest 4: Local network interfaces".to_string());
    match Command::new("ifconfig").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("inet ") && !line.contains("127.0.0.1") {
                    results.push(format!("  {}", line.trim()));
                }
            }
        }
        Err(e) => results.push(format!("  ❌ ifconfig failed: {}", e)),
    }

    // Test 5: Route to target
    results.push("\nTest 5: Route to target".to_string());
    match Command::new("route").args(["-n", "get", &ip]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().take(5) {
                results.push(format!("  {}", line));
            }
        }
        Err(e) => results.push(format!("  ❌ route failed: {}", e)),
    }

    Ok(results.join("\n"))
}

#[tauri::command]
pub fn request_macos_local_network_permission() -> String {
    #[cfg(target_os = "macos")]
    {
        crate::macos_permission::request_local_network_permission();
        "Permission request triggered".to_string()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "Not on macOS".to_string()
    }
}
