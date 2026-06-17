use crate::mdns::browse_service;
use std::collections::HashSet;
use std::str::FromStr;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;
use tracing::{info, debug, warn};
use std::process::Command;

use librespot_oauth::OAuthClientBuilder;
use librespot_core::{authentication::Credentials, Session};
use librespot_core::config::SessionConfig;
use librespot_core::cache::Cache;

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

/// Spotify Connect-compatible OAuth token obtained via librespot-oauth.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct LibrespotToken {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
    pub scopes: Vec<String>,
}

/// Authenticate with Spotify using the same PKCE OAuth flow that librespot
/// itself uses. The resulting access token can be used both for the Web API
/// and to create a `librespot_core::Session` for local Connect playback.
///
/// This command blocks a thread while it waits for the browser callback, so it
/// is run inside `spawn_blocking`.
#[tauri::command]
pub async fn authenticate_librespot_oauth() -> Result<LibrespotToken, String> {
    let client_id = get_spotify_client_id()?;

    // Use a dedicated redirect URI for librespot-oauth so it can bind its own
    // local HTTP server. This must be registered in the Spotify app dashboard.
    let redirect_uri = std::env::var("SPOTIFY_LIBRESPOT_REDIRECT_URI")
        .unwrap_or_else(|_| "http://127.0.0.1:8989/login".to_string());

    // Scopes must include `streaming` for librespot session authentication.
    let scopes = vec![
        "streaming",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-library-read",
        "user-library-modify",
        "user-read-recently-played",
        "user-top-read",
        "user-follow-read",
    ];

    info!(
        "Starting librespot-oauth flow for client_id={} redirect_uri={}",
        client_id, redirect_uri
    );

    let token = tokio::task::spawn_blocking(move || {
        let client = OAuthClientBuilder::new(&client_id, &redirect_uri, scopes)
            .open_in_browser()
            .build()
            .map_err(|e| format!("Failed to build OAuth client: {e}"))?;

        client
            .get_access_token()
            .map_err(|e| format!("OAuth authentication failed: {e}"))
    })
    .await
    .map_err(|e| format!("OAuth task panicked: {e}"))?
    .map_err(|e| e.to_string())?;

    info!("librespot-oauth token acquired successfully");

    let expires_in = token
        .expires_at
        .saturating_duration_since(std::time::Instant::now())
        .as_secs();
    let expires_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        + expires_in;

    Ok(LibrespotToken {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at,
        scopes: token.scopes,
    })
}

/// Create a librespot `Session` and authenticate it with the given access token.
/// This proves the token is accepted by Spotify's access-point servers.
#[tauri::command]
pub async fn create_librespot_session(access_token: String) -> Result<String, String> {
    let session_config = SessionConfig::default();
    let cache = Cache::new(None::<String>, None, None, None).map_err(|e| e.to_string())?;
    let session = Session::new(session_config, Some(cache));

    let credentials = Credentials::with_access_token(access_token);

    session
        .connect(credentials, true)
        .await
        .map_err(|e| format!("librespot session connection failed: {e}"))?;

    let username = session.username();
    let username = if username.is_empty() {
        "UNKNOWN".to_string()
    } else {
        username
    };

    info!("librespot session authenticated as {}", username);
    Ok(username)
}

/// Start a local Spotify Connect device using librespot.
/// Returns the device ID that can be used to transfer playback via the Web API.
#[tauri::command]
pub async fn start_local_connect_device(
    access_token: String,
    name: String,
    volume_percent: u16,
) -> Result<String, String> {
    use crate::events::helpers as event;
    
    // Emit event: local connect started
    event::local_connect_started().await;
    
    let result = crate::librespot_player::start_connect_device(
        access_token, 
        name.clone(), 
        volume_percent
    ).await;
    
    match result {
        Ok(device) => {
            // Emit event: local connect completed
            event::local_connect_completed(device.device_id.clone()).await;
            Ok(device.device_id)
        }
        Err(e) => {
            // Emit event: local connect failed
            event::local_connect_failed(e.clone()).await;
            Err(e)
        }
    }
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
        // rust_cast uses rustls; make sure a crypto provider is installed.
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

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
            return Ok("Speaker is ready".to_string());
        }

        // Step 3: Try to launch Spotify (may fail with NOT_FOUND on some devices)
        let spotify_app = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753")
            .or_else(|_| rust_cast::channels::receiver::CastDeviceApp::from_str("705D30C6"))
            .or_else(|_| rust_cast::channels::receiver::CastDeviceApp::from_str("531A4F84"))
            .or_else(|_| rust_cast::channels::receiver::CastDeviceApp::from_str("CC320225"))
            .map_err(|_| "Invalid app ID".to_string())?;

        match cast_device.receiver.launch_app(&spotify_app) {
            Ok(_) => Ok("Speaker activated".to_string()),
            Err(e) => {
                let msg = format!("{}", e);
                if msg.contains("NOT_FOUND") {
                    Err("This speaker needs to be activated. Select SPX Player to play here, or wake the speaker from SPX and try again.".to_string())
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

/// Resolve the token to use for Cast authentication.
/// Priority:
/// 1. `sp_dc` stored by the embedded cookie capture (if `app` is provided).
/// 2. `SPOTIFY_SP_DC` environment variable.
/// 3. Fall back to the supplied access token.
async fn resolve_cast_token(
    access_token: String,
    app: Option<tauri::AppHandle>,
) -> Result<String, String> {
    // 1. Stored cookie.
    if let Some(app) = &app {
        match crate::cookie_capture::load_sp_dc(app).await {
            Ok(sp_dc) if !sp_dc.trim().is_empty() => {
                info!("Stored sp_dc found; fetching Web Player token for Cast auth");
                match crate::web_player_token::get_web_player_token(Some(&sp_dc)).await {
                    Ok(token) => {
                        info!("Using Web Player token for Cast authentication");
                        return Ok(token.access_token);
                    }
                    Err(e) => {
                        return Err(format!(
                            "Stored sp_dc is present but Web Player token fetch failed: {e}. \
                             Try clearing the stored cookie and logging in again."
                        ));
                    }
                }
            }
            _ => {}
        }
    }

    // 2. Environment variable.
    if let Ok(sp_dc) = std::env::var("SPOTIFY_SP_DC") {
        if !sp_dc.trim().is_empty() {
            info!("SPOTIFY_SP_DC is set; fetching Web Player token for Cast auth");
            match crate::web_player_token::get_web_player_token(Some(&sp_dc)).await {
                Ok(token) => {
                    info!("Using Web Player token for Cast authentication");
                    return Ok(token.access_token);
                }
                Err(e) => {
                    return Err(format!(
                        "SPOTIFY_SP_DC is set but Web Player token fetch failed: {e}. \
                         Cast authentication requires a valid sp_dc cookie from open.spotify.com."
                    ));
                }
            }
        }
    }

    // 3. Fall back.
    info!("No sp_dc available; using supplied access token for Cast auth");
    Ok(access_token)
}

#[tauri::command]
pub async fn authenticate_cast_device_command(
    app: tauri::AppHandle,
    ip: String,
    access_token: String,
    device_name: String,
) -> Result<String, String> {
    use crate::events::helpers as event;
    
    info!("Authenticating Cast device {} at {}", device_name, ip);
    
    // Emit event: auth started
    event::cast_auth_started(device_name.clone()).await;

    let token_to_use = resolve_cast_token(access_token, Some(app)).await?;

    let ip_owned = ip;
    let token_owned = token_to_use;
    let name_owned = device_name.clone();

    let result = tokio::task::spawn_blocking(move || {
        // Emit progress events during authentication
        tracing::info!("[CastAuth] Starting authentication for {}", name_owned);
        crate::spotify_cast::authenticate_cast_device(
            &ip_owned,
            &token_owned,
            &name_owned,
        )
    });

    // Wrap in a 70-second timeout (internal waits can sum to ~50s)
    match timeout(Duration::from_secs(70), result).await {
        Ok(Ok(Ok(s))) => {
            // Emit event: auth completed
            event::cast_auth_completed(device_name).await;
            Ok(s)
        }
        Ok(Ok(Err(e))) => {
            // Emit event: auth failed
            event::cast_auth_failed(device_name, e.clone()).await;
            Err(e)
        }
        Ok(Err(_)) => {
            let err = "Cast auth task panicked".to_string();
            event::cast_auth_failed(device_name, err.clone()).await;
            Err(err)
        }
        Err(_) => {
            let err = "Cast auth timed out after 70 seconds".to_string();
            event::cast_auth_failed(device_name, err.clone()).await;
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn authenticate_cast_device_raw_command(
    app: tauri::AppHandle,
    ip: String,
    access_token: String,
) -> Result<String, String> {
    info!("Authenticating Cast device at {} using raw protocol", ip);

    let token_to_use = resolve_cast_token(access_token, Some(app)).await?;

    let ip_owned = ip;
    let token_owned = token_to_use;

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
pub async fn get_web_player_token_command(sp_dc: Option<String>) -> Result<crate::web_player_token::WebPlayerToken, String> {
    crate::web_player_token::get_web_player_token(sp_dc.as_deref()).await
}

#[tauri::command]
pub async fn start_spotify_cookie_capture(app: tauri::AppHandle) -> Result<String, String> {
    crate::cookie_capture::start_cookie_capture(app).await
}

#[tauri::command]
pub async fn clear_spotify_sp_dc(app: tauri::AppHandle) -> Result<(), String> {
    crate::cookie_capture::clear_sp_dc(&app).await
}

#[tauri::command]
pub async fn get_stored_sp_dc(app: tauri::AppHandle) -> Result<String, String> {
    crate::cookie_capture::load_sp_dc(&app).await
}

#[tauri::command]
pub fn get_callback_server_status() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "listening": crate::oauth_callback::is_callback_server_listening(),
        "port": 1422,
        "uri": "http://127.0.0.1:1422/callback",
    }))
}

#[tauri::command]
pub async fn get_diagnostics(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use serde_json::json;

    let has_sp_dc = crate::cookie_capture::has_stored_sp_dc(&app).await.unwrap_or(false);

    let credentials = check_credentials_status().unwrap_or_else(|_| {
        json!({
            "configured": false,
            "client_id_status": "unknown",
            "client_secret_status": "unknown"
        })
    });

    #[cfg(target_os = "macos")]
    let (macos_version, spx_force_librespot) = {
        let version = crate::librespot_player::macos_product_version().unwrap_or_default();
        let forced = std::env::var("SPX_FORCE_LIBRESPOT").is_ok();
        (version, forced)
    };

    #[cfg(not(target_os = "macos"))]
    let (macos_version, spx_force_librespot) = (None::<String>, false);

    Ok(json!({
        "credentials": credentials,
        "has_stored_sp_dc": has_sp_dc,
        "macos_version": macos_version,
        "spx_force_librespot": spx_force_librespot,
        "app_version": app.package_info().version.to_string(),
        "tauri_version": tauri::VERSION,
    }))
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

/// Subscribe to the event stream.
/// Returns recent events for initial sync, then events are emitted via Tauri events.
#[tauri::command]
pub async fn get_event_history(limit: Option<usize>) -> Result<Vec<serde_json::Value>, String> {
    let bus = crate::events::EVENT_BUS.read().await;
    let events = bus.history(limit.unwrap_or(50)).await;
    
    // Convert to JSON-serializable format
    Ok(events
        .into_iter()
        .map(|e| serde_json::to_value(&e).unwrap_or_else(|_| serde_json::json!({"type": "unknown"})))
        .collect())
}

/// Emit a custom event from the frontend.
/// Used for testing the event system or triggering event-based flows.
#[tauri::command]
pub async fn emit_spx_event(event: serde_json::Value) -> Result<(), String> {
    use crate::events::SpxEvent;
    
    let spx_event: SpxEvent = serde_json::from_value(event)
        .map_err(|e| format!("Invalid event format: {}", e))?;
    
    crate::events::EVENT_BUS.read().await.publish(spx_event).await;
    Ok(())
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use librespot_oauth::OAuthClientBuilder;
    use librespot_core::{authentication::Credentials, cache::Cache, config::SessionConfig, Session};

    /// Helper used by ignored real-network tests: resolve the Cast token (env var
    /// fallback only) and call the underlying Cast auth function directly.
    async fn authenticate_cast_test(
        ip: String,
        access_token: String,
        device_name: String,
    ) -> Result<String, String> {
        let token = resolve_cast_token(access_token, None).await?;
        tokio::time::timeout(std::time::Duration::from_secs(70), tokio::task::spawn_blocking(move || {
            crate::spotify_cast::authenticate_cast_device(&ip, &token, &device_name)
        }))
        .await
        .map_err(|_| "Cast auth timed out after 70s".to_string())?
        .map_err(|e| format!("Cast auth task panicked: {e}"))?
    }

    /// Real data test: start a local librespot Connect device and prove it can
    /// actually decode and play audio. Starts playback at 10% volume, waits a
    /// couple of seconds, then pauses. Ignored by default.
    #[tokio::test]
    #[ignore]
    async fn test_local_connect_device_playback() {
        let token_path = std::path::PathBuf::from("/tmp/spx_refreshed_token.json");
        let token_file = std::fs::read_to_string(&token_path)
            .unwrap_or_else(|_| {
                let fallback = std::path::PathBuf::from("/tmp/spx_token.json");
                std::fs::read_to_string(&fallback)
                    .unwrap_or_else(|_| panic!("Could not read {:?} or {:?}", token_path, fallback))
            });
        let token_json: serde_json::Value = serde_json::from_str(&token_file)
            .expect("Invalid token JSON");
        let access_token = token_json["access_token"]
            .as_str()
            .expect("Token missing access_token field")
            .to_string();

        let device_name = "SPX Playback Test".to_string();
        println!("Starting local Connect device '{}' at 10% volume...", device_name);
        let device = crate::librespot_player::start_connect_device(
            access_token.clone(),
            device_name.clone(),
            10,
        )
        .await
        .expect("failed to start local Connect device");
        println!("  ✅ Local device started with device_id={}", device.device_id);

        // Wait for device to appear in Spotify.
        println!("Waiting for device to appear in Spotify Connect list...");
        let spotify_device_id = tokio::time::timeout(Duration::from_secs(45), async {
            loop {
                let output = tokio::process::Command::new("curl")
                    .args([
                        "-s", "https://api.spotify.com/v1/me/player/devices",
                        "-H", &format!("Authorization: Bearer {}", access_token),
                    ])
                    .output()
                    .await
                    .expect("curl failed");
                let body = String::from_utf8_lossy(&output.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(devices) = json.get("devices").and_then(|d| d.as_array()) {
                        for d in devices {
                            let name = d["name"].as_str().unwrap_or("");
                            let id = d["id"].as_str().unwrap_or("");
                            if name == device_name || id == device.device_id {
                                return id.to_string();
                            }
                        }
                    }
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        })
        .await
        .expect("Timed out waiting for local device to appear");
        println!("  ✅ Found Spotify Connect device ID: {}", spotify_device_id);

        // Start playback of a specific track on the local device.
        println!("Starting playback on local device (10% volume)...");
        let play_body = r#"{"uris":["spotify:track:0ltGRPI3PfhyCa3htMsDPT"],"position_ms":0}"#;
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "-X", "PUT",
                &format!("https://api.spotify.com/v1/me/player/play?device_id={}", spotify_device_id),
                "-H", &format!("Authorization: Bearer {}", access_token),
                "-H", "Content-Type: application/json",
                "-d", play_body,
            ])
            .output()
            .await
            .expect("curl play failed");
        assert!(output.status.success(), "play request failed");

        // Wait briefly for audio to start decoding.
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Verify it reports playing.
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "https://api.spotify.com/v1/me/player",
                "-H", &format!("Authorization: Bearer {}", access_token),
            ])
            .output()
            .await
            .expect("curl failed");
        let body = String::from_utf8_lossy(&output.stdout);
        let state: serde_json::Value = serde_json::from_str(&body).expect("Invalid playback state");
        assert_eq!(state["device"]["id"].as_str(), Some(spotify_device_id.as_str()), "Active device mismatch");
        let was_playing = state["is_playing"].as_bool().unwrap_or(false);
        println!("  Playback state after start: is_playing={}", was_playing);

        // Pause immediately to avoid loud/extended playback.
        println!("Pausing playback...");
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "-X", "PUT", "https://api.spotify.com/v1/me/player/pause",
                "-H", &format!("Authorization: Bearer {}", access_token),
            ])
            .output()
            .await
            .expect("curl pause failed");
        assert!(output.status.success(), "pause request failed");

        tokio::time::sleep(Duration::from_secs(2)).await;
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "https://api.spotify.com/v1/me/player",
                "-H", &format!("Authorization: Bearer {}", access_token),
            ])
            .output()
            .await
            .expect("curl failed");
        let body = String::from_utf8_lossy(&output.stdout);
        let state: serde_json::Value = serde_json::from_str(&body).expect("Invalid playback state");
        assert!(!state["is_playing"].as_bool().unwrap_or(true), "Playback should be paused");
        assert_eq!(state["device"]["id"].as_str(), Some(spotify_device_id.as_str()), "Active device mismatch after pause");

        println!("✅ Local SPX Connect device can play and pause audio successfully");

        // Keep alive briefly for observability.
        tokio::time::sleep(Duration::from_secs(3)).await;
    }

    /// Real data test: start a local librespot Connect device, wait for it to
    /// appear in the Spotify device list, and transfer playback to it without
    /// starting audio. Ignored by default because it requires a valid token.
    #[tokio::test]
    #[ignore]
    async fn test_local_connect_device_transfer() {
        let token_path = std::path::PathBuf::from("/tmp/spx_refreshed_token.json");
        let token_file = std::fs::read_to_string(&token_path)
            .unwrap_or_else(|_| {
                let fallback = std::path::PathBuf::from("/tmp/spx_token.json");
                std::fs::read_to_string(&fallback)
                    .unwrap_or_else(|_| panic!("Could not read {:?} or {:?}", token_path, fallback))
            });
        let token_json: serde_json::Value = serde_json::from_str(&token_file)
            .expect("Invalid token JSON");
        let access_token = token_json["access_token"]
            .as_str()
            .expect("Token missing access_token field")
            .to_string();

        // Start a local Connect device.
        let device_name = "SPX Test Device".to_string();
        println!("Starting local Connect device '{}'...", device_name);
        let device = crate::librespot_player::start_connect_device(
            access_token.clone(),
            device_name.clone(),
            30,
        )
        .await
        .expect("failed to start local Connect device");
        println!("  ✅ Local device started with device_id={}", device.device_id);

        // Poll Spotify for the device to appear.
        println!("Waiting for device to appear in Spotify Connect list...");
        let spotify_device_id = tokio::time::timeout(Duration::from_secs(45), async {
            loop {
                let output = tokio::process::Command::new("curl")
                    .args([
                        "-s", "https://api.spotify.com/v1/me/player/devices",
                        "-H", &format!("Authorization: Bearer {}", access_token),
                    ])
                    .output()
                    .await
                    .expect("curl failed");
                let body = String::from_utf8_lossy(&output.stdout);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(devices) = json.get("devices").and_then(|d| d.as_array()) {
                        for d in devices {
                            let name = d["name"].as_str().unwrap_or("");
                            let id = d["id"].as_str().unwrap_or("");
                            println!("    Spotify device: {} ({})", name, id);
                            if name == device_name || id == device.device_id {
                                return id.to_string();
                            }
                        }
                    }
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        })
        .await
        .expect("Timed out waiting for local device to appear");

        println!("  ✅ Found Spotify Connect device ID: {}", spotify_device_id);

        // Transfer playback to the local device without starting audio.
        println!("Transferring playback to local device (play=false)...");
        let transfer_body = format!("{{\"device_ids\":[\"{}\"],\"play\":false}}", spotify_device_id);
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "-X", "PUT", "https://api.spotify.com/v1/me/player",
                "-H", &format!("Authorization: Bearer {}", access_token),
                "-H", "Content-Type: application/json",
                "-d", &transfer_body,
            ])
            .output()
            .await
            .expect("curl transfer failed");
        println!("  Transfer response: {:?} {}", output.status, String::from_utf8_lossy(&output.stdout));
        assert!(output.status.success(), "transfer request failed");

        // Verify playback state shows our device as active.
        tokio::time::sleep(Duration::from_secs(2)).await;
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "https://api.spotify.com/v1/me/player",
                "-H", &format!("Authorization: Bearer {}", access_token),
            ])
            .output()
            .await
            .expect("curl failed");
        let body = String::from_utf8_lossy(&output.stdout);
        println!("  Playback state: {}", body);
        let state: serde_json::Value = serde_json::from_str(&body).expect("Invalid playback state");
        let active_device = state["device"]["id"].as_str().expect("No active device in playback state");
        assert_eq!(active_device, spotify_device_id, "Active device does not match local device");
        println!("✅ Playback transferred to local SPX Connect device successfully (audio not started)");

        // Keep the device alive for a moment so the test is observable.
        tokio::time::sleep(Duration::from_secs(5)).await;
    }

    /// Real data test: try to authenticate a librespot session using the access
    /// token that SPX's browser OAuth flow already wrote to /tmp/spx_token.json
    /// or a refreshed token at /tmp/spx_refreshed_token.json.
    /// Ignored by default because it depends on an existing token file.
    #[tokio::test]
    #[ignore]
    async fn test_existing_token_librespot_session() {
        let token_path = std::path::PathBuf::from("/tmp/spx_refreshed_token.json");
        let token_file = std::fs::read_to_string(&token_path)
            .unwrap_or_else(|_| {
                let fallback = std::path::PathBuf::from("/tmp/spx_token.json");
                std::fs::read_to_string(&fallback)
                    .unwrap_or_else(|_| panic!("Could not read {:?} or {:?}. Run browser auth first.", token_path, fallback))
            });
        let token_json: serde_json::Value = serde_json::from_str(&token_file)
            .expect("Invalid token JSON");
        let access_token = token_json["access_token"]
            .as_str()
            .expect("Token missing access_token field")
            .to_string();

        // Test 1: default SessionConfig (uses librespot KEYMASTER_CLIENT_ID)
        println!("Attempting librespot session with refreshed SPX token (default client_id)...");
        let session_config = SessionConfig::default();
        let cache = Cache::new(None::<String>, None, None, None).expect("Failed to create cache");
        let session = Session::new(session_config, Some(cache));
        let credentials = Credentials::with_access_token(access_token.clone());
        match session.connect(credentials, true).await {
            Ok(_) => println!("✅ Refreshed SPX token works with DEFAULT client_id as '{}'", session.username()),
            Err(e) => println!("❌ Refreshed SPX token failed with default client_id: {e}"),
        }

        // Test 2: SessionConfig with SPX client_id matching the OAuth token
        let client_id = get_spotify_client_id().expect("SPOTIFY_CLIENT_ID must be configured");
        println!("Attempting librespot session with refreshed SPX token (SPX client_id={})...", client_id);
        let mut session_config = SessionConfig::default();
        session_config.client_id = client_id;
        let cache = Cache::new(None::<String>, None, None, None).expect("Failed to create cache");
        let session = Session::new(session_config, Some(cache));
        let credentials = Credentials::with_access_token(access_token);
        match session.connect(credentials, true).await {
            Ok(_) => println!("✅ Refreshed SPX token works with SPX client_id as '{}'", session.username()),
            Err(e) => println!("❌ Refreshed SPX token failed with SPX client_id: {e}"),
        }
    }

    /// Interactive test: prove that SPX's own Spotify client ID can obtain a
    /// librespot-oauth token and use it to create a `librespot_core::Session`.
    /// Ignored by default because it requires a browser login.
    #[tokio::test]
    #[ignore]
    async fn test_librespot_oauth_session_with_spx_client() {
        let client_id = get_spotify_client_id().expect("SPOTIFY_CLIENT_ID must be configured");
        let redirect_uri = std::env::var("SPOTIFY_LIBRESPOT_REDIRECT_URI")
            .unwrap_or_else(|_| "http://127.0.0.1:8989/login".to_string());

        let scopes = vec![
            "streaming",
            "user-read-playback-state",
            "user-modify-playback-state",
            "user-read-currently-playing",
            "user-read-private",
            "user-read-email",
            "playlist-read-private",
            "playlist-read-collaborative",
            "user-library-read",
            "user-library-modify",
            "user-read-recently-played",
            "user-top-read",
            "user-follow-read",
        ];

        println!("Starting librespot-oauth with SPX client ID: {}", client_id);
        println!("Redirect URI: {}", redirect_uri);
        println!("Make sure this redirect URI is registered in your Spotify app dashboard.");

        let token = tokio::task::spawn_blocking(move || {
            let client = OAuthClientBuilder::new(&client_id, &redirect_uri, scopes)
                .build()
                .expect("Failed to build OAuth client");
            client
                .get_access_token()
                .expect("Failed to get access token")
        })
        .await
        .expect("OAuth task panicked");

        println!("Access token acquired: {}...", &token.access_token[..20.min(token.access_token.len())]);
        println!("Scopes: {:?}", token.scopes);

        // Now prove the token works with librespot_core.
        let session_config = SessionConfig::default();
        let cache = Cache::new(None::<String>, None, None, None).expect("Failed to create cache");
        let session = Session::new(session_config, Some(cache));

        let credentials = Credentials::with_access_token(token.access_token);
        session
            .connect(credentials, true)
            .await
            .expect("librespot session connection failed");

        println!("✅ librespot session authenticated successfully as '{}'", session.username());
    }

    /// Real network test: discover Cast devices and verify TCP reachability.
    /// Ignored by default because it requires local network hardware.
    #[tokio::test]
    #[ignore]
    async fn test_real_device_discovery_and_reachability() {
        let devices = scan_spotify_devices().await.expect("scan should succeed");
        println!("Discovered {} device(s):", devices.len());
        for d in &devices {
            println!("  {} at {}:{}", d.name, d.ip, d.port);
        }
        assert!(!devices.is_empty(), "expected at least one device on the network");

        // Verify TCP port 8009 is reachable on the first Cast device
        let first = devices.iter().find(|d| d.port == 8009).unwrap_or(&devices[0]);
        let addr = format!("{}:8009", first.ip);
        println!("Checking TCP reachability for {}...", addr);
        match timeout(Duration::from_secs(3), TcpStream::connect(&addr)).await {
            Ok(Ok(_)) => println!("  ✅ TCP connect succeeded"),
            Ok(Err(e)) => panic!("TCP connect failed for {}: {}", addr, e),
            Err(_) => panic!("TCP connect timed out for {}", addr),
        }
    }

    /// Real network test: attempt to wake the first Cast device.
    /// Ignored by default; may launch the Spotify receiver on the speaker.
    #[tokio::test]
    #[ignore]
    async fn test_real_cast_wake() {
        let devices = scan_spotify_devices().await.expect("scan should succeed");
        let first = devices.iter().find(|d| d.port == 8009).expect("expected a Cast device on port 8009");
        println!("Attempting to wake {} at {}...", first.name, first.ip);
        match wake_cast_device(first.ip.clone()).await {
            Ok(msg) => println!("  ✅ Wake succeeded: {}", msg),
            Err(e) => println!("  ⚠️ Wake returned: {} (device may already be ready)", e),
        }
    }

    /// Real data test: prove that a librespot login5 auth token can authenticate
    /// a Google Cast device. This would allow Cast playback without a Web Player
    /// token. Ignored by default because it requires a Cast device on the LAN.
    #[tokio::test]
    #[ignore]
    async fn test_login5_token_cast_auth() {
        let token_path = std::path::PathBuf::from("/tmp/spx_refreshed_token.json");
        let token_file = std::fs::read_to_string(&token_path)
            .unwrap_or_else(|_| {
                let fallback = std::path::PathBuf::from("/tmp/spx_token.json");
                std::fs::read_to_string(&fallback)
                    .unwrap_or_else(|_| panic!("Could not read {:?} or {:?}", token_path, fallback))
            });
        let token_json: serde_json::Value = serde_json::from_str(&token_file)
            .expect("Invalid token JSON");
        let access_token = token_json["access_token"]
            .as_str()
            .expect("Token missing access_token field")
            .to_string();

        // Create a librespot session with the Web API token.
        println!("Creating librespot session to obtain login5 token...");
        let session_config = SessionConfig::default();
        let cache = Cache::new(None::<String>, None, None, None).expect("Failed to create cache");
        let session = Session::new(session_config, Some(cache));
        let credentials = Credentials::with_access_token(access_token);
        session.connect(credentials, true).await.expect("librespot session connection failed");
        println!("  ✅ Session authenticated as '{}'", session.username());

        // Get a login5 access token.
        let login5_token = session.login5().auth_token().await.expect("failed to get login5 token");
        println!("  ✅ Got login5 token: {}...", &login5_token.access_token[..20.min(login5_token.access_token.len())]);

        // Try Cast auth with the login5 token.
        let devices = scan_spotify_devices().await.expect("scan should succeed");
        let target = devices.iter().find(|d| d.port == 8009).expect("expected a Cast device on port 8009");
        println!("Trying Cast auth for {} at {} with login5 token...", target.name, target.ip);

        match authenticate_cast_test(target.ip.clone(), login5_token.access_token, target.name.clone()).await {
            Ok(msg) => println!("✅ Cast auth with login5 token succeeded: {}", msg),
            Err(e) => println!("❌ Cast auth with login5 token failed: {}", e),
        }
    }

    /// Real network test: prove that a Web Player token (obtained via SPOTIFY_SP_DC)
    /// can authenticate a Google Cast device. Requires SPOTIFY_SP_DC to be set and a
    /// Cast device on the LAN.
    #[tokio::test]
    #[ignore]
    async fn test_web_player_token_cast_auth() {
        let devices = scan_spotify_devices().await.expect("scan should succeed");
        let target = devices.iter().find(|d| d.port == 8009).expect("expected a Cast device on port 8009");
        println!("Trying Cast auth for {} at {} with Web Player token...", target.name, target.ip);

        match authenticate_cast_test(target.ip.clone(), "ignored-token".to_string(), target.name.clone()).await {
            Ok(msg) => println!("✅ Cast auth with Web Player token succeeded: {}", msg),
            Err(e) => println!("❌ Cast auth with Web Player token failed: {}", e),
        }
    }

    /// Real network test: discover a local device, wake it, transfer Spotify
    /// playback to it (without starting playback), and verify it becomes the
    /// active device. Requires a Spotify premium account and local Cast/Connect
    /// hardware. Audio is NOT started; we only move the active device.
    #[tokio::test]
    #[ignore]
    async fn test_real_transfer_to_local_device() {
        // Prefer the refreshed token; fall back to the original browser token.
        let token_path = std::path::PathBuf::from("/tmp/spx_refreshed_token.json");
        let token_file = std::fs::read_to_string(&token_path)
            .unwrap_or_else(|_| {
                let fallback = std::path::PathBuf::from("/tmp/spx_token.json");
                std::fs::read_to_string(&fallback)
                    .unwrap_or_else(|_| panic!("Could not read {:?} or {:?}. Run browser auth first.", token_path, fallback))
            });
        let token_json: serde_json::Value = serde_json::from_str(&token_file)
            .expect("Invalid token JSON");
        let access_token = token_json["access_token"]
            .as_str()
            .expect("Token missing access_token field");

        // Discover local devices.
        let devices = scan_spotify_devices().await.expect("scan should succeed");
        assert!(!devices.is_empty(), "expected at least one local device");
        let target = devices.iter().find(|d| d.port == 8009).unwrap_or(&devices[0]);
        println!("Target device: {} at {}", target.name, target.ip);

        // Authenticate the Cast device with Spotify so it appears as a Connect target.
        println!("Authenticating Cast device with Spotify...");
        match authenticate_cast_test(target.ip.clone(), access_token.to_string(), target.name.clone()).await {
            Ok(msg) => println!("  ✅ Auth succeeded: {}", msg),
            Err(e) => println!("  ⚠️ Auth returned: {} (continuing)", e),
        }

        // Poll Spotify for the device to appear as a Connect target.
        let spotify_device_id = tokio::time::timeout(Duration::from_secs(45), async {
            loop {
                let output = tokio::process::Command::new("curl")
                    .args([
                        "-s", "https://api.spotify.com/v1/me/player/devices",
                        "-H", &format!("Authorization: Bearer {}", access_token),
                    ])
                    .output()
                    .await
                    .expect("curl failed");
                let body = String::from_utf8_lossy(&output.stdout);
                println!("Spotify devices response: {}", body);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(devices) = json.get("devices").and_then(|d| d.as_array()) {
                        for device in devices {
                            let name = device["name"].as_str().unwrap_or("");
                            if name.to_lowercase().contains(&target.name.to_lowercase())
                                || target.name.to_lowercase().contains(&name.to_lowercase())
                            {
                                return device["id"].as_str().map(String::from);
                            }
                        }
                    }
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        })
        .await
        .expect("Timed out waiting for Spotify device to appear")
        .expect("Could not find matching Spotify Connect device");

        println!("Found Spotify Connect device ID: {}", spotify_device_id);

        // Transfer playback to the device WITHOUT starting playback.
        let transfer_body = format!("{{\"device_ids\":[\"{}\"],\"play\":false}}", spotify_device_id);
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "-X", "PUT", "https://api.spotify.com/v1/me/player",
                "-H", &format!("Authorization: Bearer {}", access_token),
                "-H", "Content-Type: application/json",
                "-d", &transfer_body,
            ])
            .output()
            .await
            .expect("curl transfer failed");
        println!("Transfer response status: {:?}, body: {}", output.status, String::from_utf8_lossy(&output.stdout));
        assert!(output.status.success(), "curl command failed");

        // Verify playback state shows our device as active.
        tokio::time::sleep(Duration::from_secs(2)).await;
        let output = tokio::process::Command::new("curl")
            .args([
                "-s", "https://api.spotify.com/v1/me/player",
                "-H", &format!("Authorization: Bearer {}", access_token),
            ])
            .output()
            .await
            .expect("curl failed");
        let body = String::from_utf8_lossy(&output.stdout);
        println!("Playback state: {}", body);
        let state: serde_json::Value = serde_json::from_str(&body).expect("Invalid playback state");
        let active_device = state["device"]["id"].as_str().expect("No active device in playback state");
        assert_eq!(active_device, spotify_device_id, "Active device does not match target");
        println!("✅ Playback transferred to local device successfully (audio not started)");
    }
}
