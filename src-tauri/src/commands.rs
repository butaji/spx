use crate::mdns::browse_service;
use std::collections::HashSet;
use std::str::FromStr;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;
use tracing::{info, debug, warn};

#[tauri::command]
pub fn is_mock_mode() -> bool {
    std::env::var("SPX_MOCK").unwrap_or_default() == "1"
}

#[tauri::command]
pub fn get_spotify_client_id() -> Result<String, String> {
    debug!("get_spotify_client_id called");
    if is_mock_mode() {
        debug!("Mock mode: returning mock client ID");
        return Ok("mock_client_id".to_string());
    }
    let id = std::env::var("SPOTIFY_CLIENT_ID")
        .or_else(|_| std::env::var("VITE_SPOTIFY_CLIENT_ID"))
        .map_err(|_| "SPOTIFY_CLIENT_ID or VITE_SPOTIFY_CLIENT_ID must be set".to_string())?;
    debug!("Resolved client ID: {}", id);
    Ok(id)
}

#[tauri::command]
pub async fn start_callback_server() -> Result<Option<(String, String)>, String> {
    info!("Starting OAuth callback server on 127.0.0.1:1422");
    let listener = TcpListener::bind("127.0.0.1:1422").await
        .map_err(|e| e.to_string())?;
    debug!("Callback server bound successfully");

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        async {
            info!("Got callback connection");
            let (mut socket, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut buf = [0u8; 4096];
            let n = socket.read(&mut buf).await.map_err(|e| e.to_string())?;
            let request = String::from_utf8_lossy(&buf[..n]);
            debug!("Parsed request: {}", request);

            let mut code = None;
            let mut state = None;
            for line in request.lines() {
                if line.starts_with("GET /callback?") {
                    let query = line.split(' ').nth(1).unwrap_or("")
                        .trim_start_matches("/callback?");
                    for param in query.split('&') {
                        let mut parts = param.splitn(2, '=');
                        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                            let decoded = urlencoding::decode(value).unwrap_or_default().to_string();
                            match key {
                                "code" => {
                                    code = Some(decoded.clone());
                                    debug!("Found auth code in callback");
                                },
                                "state" => {
                                    state = Some(decoded.clone());
                                    debug!("Found state in callback");
                                },
                                _ => {}
                            }
                        }
                    }
                    break;
                }
            }

            if code.is_none() {
                debug!("No auth code in callback request");
            }

            let body = if code.is_some() {
                "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h1>✅ Auth Successful!</h1><p>You can close this window and return to SPX.</p></body></html>"
            } else {
                "<html><body><h1>❌ Auth Failed</h1><p>No authorization code received.</p></body></html>"
            };

            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            socket.write_all(response.as_bytes()).await.ok();
            socket.flush().await.ok();

            Ok::<_, String>((code, state))
        }
    ).await;

    match result {
        Ok(Ok((Some(code), Some(state)))) => Ok(Some((code, state))),
        Ok(Ok(_)) => Ok(None),
        Ok(Err(e)) => Err(e),
        Err(_) => {
            info!("Callback server timed out");
            Err("Callback server timeout".to_string())
        },
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
