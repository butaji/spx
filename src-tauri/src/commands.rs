use crate::mdns::browse_service;
use std::collections::HashSet;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::{info, debug};

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
    info!("Starting callback server on 127.0.0.1:1421");
    let listener = TcpListener::bind("127.0.0.1:1421").await
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

    let mut devices: Vec<LocalDevice> = Vec::new();
    let mut seen: HashSet<(String, String)> = HashSet::new();

    // Process Google Cast devices
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

    // Process Spotify Connect devices
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
