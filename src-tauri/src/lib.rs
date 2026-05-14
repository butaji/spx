use std::println;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tauri::Emitter;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
#[tauri::command]
fn is_mock_mode() -> bool {
    std::env::var("SPX_MOCK").unwrap_or_default() == "1"
}

#[tauri::command]
fn get_spotify_client_id() -> Result<String, String> {
    println!("get_spotify_client_id called");
    if is_mock_mode() {
        println!("Mock mode: returning mock client ID");
        return Ok("mock_client_id".to_string());
    }
    let id = std::env::var("SPOTIFY_CLIENT_ID")
        .or_else(|_| std::env::var("VITE_SPOTIFY_CLIENT_ID"))
        .map_err(|_| "SPOTIFY_CLIENT_ID or VITE_SPOTIFY_CLIENT_ID must be set".to_string())?;
    println!("Resolved client ID: {}", id);
    Ok(id)
}

#[tauri::command]
async fn start_callback_server() -> Result<Option<(String, String)>, String> {
    println!("Starting callback server on 127.0.0.1:1421");
    let listener = TcpListener::bind("127.0.0.1:1421").await
        .map_err(|e| e.to_string())?;
    println!("Callback server bound successfully");

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        async {
            println!("Got callback connection");
            let (mut socket, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut buf = [0u8; 4096];
            let n = socket.read(&mut buf).await.map_err(|e| e.to_string())?;
            let request = String::from_utf8_lossy(&buf[..n]);
            println!("Parsed request: {}", request);

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
                                    println!("Found auth code in callback");
                                },
                                "state" => {
                                    state = Some(decoded.clone());
                                    println!("Found state in callback");
                                },
                                _ => {}
                            }
                        }
                    }
                    break;
                }
            }

            if code.is_none() {
                println!("No auth code in callback request");
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
            println!("Callback server timed out");
            Err("Callback server timeout".to_string())
        },
    }
}

#[derive(serde::Serialize, Clone, Debug)]
struct LocalDevice {
    name: String,
    ip: String,
    port: u16,
}

#[tauri::command]
async fn scan_spotify_devices() -> Result<Vec<LocalDevice>, String> {
    println!("Starting mDNS scan for audio devices...");
    
    let mut devices = Vec::new();
    
    // Scan Google Cast devices
    match browse_service("_googlecast._tcp").await {
        Ok(cast_devices) => {
            println!("Google Cast scan found {} device(s)", cast_devices.len());
            for device in cast_devices {
                if !devices.iter().any(|d: &LocalDevice| d.name == device.name) {
                    devices.push(device);
                }
            }
        }
        Err(e) => println!("Google Cast scan error: {}", e),
    }
    
    // Scan Spotify Connect devices
    match browse_service("_spotify-connect._tcp").await {
        Ok(spotify_devices) => {
            println!("Spotify Connect scan found {} device(s)", spotify_devices.len());
            for device in spotify_devices {
                if !devices.iter().any(|d: &LocalDevice| d.name == device.name) {
                    devices.push(device);
                }
            }
        }
        Err(e) => println!("Spotify Connect scan error: {}", e),
    }
    
    println!("Total devices found: {}", devices.len());
    Ok(devices)
}

async fn browse_service(service_type: &str) -> Result<Vec<LocalDevice>, String> {
    let mut devices = Vec::new();
    
    // Step 1: Browse for instance names
    println!("Browsing {}...", service_type);
    
    let mut child = tokio::process::Command::new("dns-sd")
        .args(["-B", service_type, "local"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn dns-sd browse: {}", e))?;
    
    // Let it collect responses for 2 seconds
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    // Kill the process
    let _ = child.kill().await;
    
    // Read output
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to read browse output: {}", e))?;
    let browse_output = String::from_utf8_lossy(&output.stdout);
    
    // Parse instance names: get last field of lines containing "Add"
    let mut instance_names = Vec::new();
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
    
    println!("Found {} {} instance(s)", instance_names.len(), service_type);
    
    // Step 2: Resolve each instance
    for instance_name in instance_names {
        println!("Resolving {}...", instance_name);
        
        let mut child = tokio::process::Command::new("dns-sd")
            .args(["-L", &instance_name, service_type, "local"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn dns-sd resolve: {}", e))?;
        
        // Let it collect responses for 3 seconds
        tokio::time::sleep(Duration::from_secs(3)).await;
        
        // Kill the process
        let _ = child.kill().await;
        
        // Read output
        let output = child.wait_with_output().await
            .map_err(|e| format!("Failed to read resolve output: {}", e))?;
        let resolve_output = String::from_utf8_lossy(&output.stdout);
        
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
                    println!("  Found device: {} at {}:{}", device.name, device.ip, device.port);
                    devices.push(device);
                }
            }
        }
    }
    
    Ok(devices)
}

/// Wake up a Cast device by launching the Spotify receiver app via Cast V2.
/// Falls back to DIAL if Cast V2 fails.
#[tauri::command]
async fn wake_cast_device(ip: String) -> Result<String, String> {
    println!("Waking Cast device at {}", ip);

    // Try Cast V2 first (port 8009, TLS)
    match wake_cast_v2(&ip).await {
        Ok(result) => {
            println!("Cast V2 wake successful: {}", result);
            return Ok(result);
        }
        Err(e) => {
            println!("Cast V2 failed: {}, trying DIAL fallback...", e);
        }
    }

    // Fall back to DIAL protocol (port 8008, HTTP)
    wake_cast_dial(&ip).await
}

async fn wake_cast_v2(ip: &str) -> Result<String, String> {
    let ip_owned = ip.to_string();
    tokio::task::spawn_blocking(move || {
        use rustls::crypto::aws_lc_rs;

        // Install aws_lc_rs crypto provider
        if let Err(e) = aws_lc_rs::default_provider().install_default() {
            return Err(format!("Failed to install crypto provider: {:?}", e));
        }

        let mut cast_device = rust_cast::CastDevice::connect_without_host_verification(&ip_owned, 8009)
            .map_err(|e| format!("Cast V2 connect failed: {}", e))?;

        let spotify_app = rust_cast::channels::receiver::CastDeviceApp::from_str("CC320225")
            .map_err(|_| "Invalid app ID".to_string())?;

        match cast_device.receiver.launch_app(&spotify_app) {
            Ok(app) => Ok(format!("Spotify app launched via Cast V2: {:?}", app)),
            Err(e) => Err(format!("Cast V2 launch failed: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

async fn wake_cast_dial(ip: &str) -> Result<String, String> {
    let url = format!("http://{}:8008/apps/CC320225", ip);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    match client.post(&url)
        .header("Content-Type", "application/xml")
        .body("")
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            if status.is_success() || status.as_u16() == 201 {
                Ok(format!("Spotify app launched via DIAL (status: {})", status))
            } else {
                let body = response.text().await.unwrap_or_default();
                Err(format!("DIAL launch failed (status: {}): {}", status, body))
            }
        }
        Err(e) => Err(format!("DIAL request failed: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_spotify_client_id, start_callback_server, is_mock_mode, scan_spotify_devices, wake_cast_device])
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Build and set the menu bar on macOS
            #[cfg(target_os = "macos")]
            {
                let app_menu = Submenu::with_items(
                    app,
                    "SPX",
                    true,
                    &[
                        &PredefinedMenuItem::about(app, Some("About SPX"), None).unwrap(),
                        &PredefinedMenuItem::separator(app).unwrap(),
                        &MenuItem::with_id(app, "preferences", "Preferences...", true, Some("Cmd+,")).unwrap(),
                        &PredefinedMenuItem::separator(app).unwrap(),
                        &PredefinedMenuItem::quit(app, Some("Quit SPX")).unwrap()
                    ]
                ).unwrap();

                let playback_menu = Submenu::with_items(
                    app,
                    "Playback",
                    true,
                    &[
                        &MenuItem::with_id(app, "play_pause", "Play/Pause", true, Some("Space")).unwrap(),
                        &MenuItem::with_id(app, "next_track", "Next Track", true, Some("Cmd+Right")).unwrap(),
                        &MenuItem::with_id(app, "prev_track", "Previous Track", true, Some("Cmd+Left")).unwrap(),
                        &PredefinedMenuItem::separator(app).unwrap(),
                        &MenuItem::with_id(app, "vol_up", "Volume Up", true, Some("Cmd+Up")).unwrap(),
                        &MenuItem::with_id(app, "vol_down", "Volume Down", true, Some("Cmd+Down")).unwrap(),
                        &PredefinedMenuItem::separator(app).unwrap(),
                        &MenuItem::with_id(app, "shuffle", "Shuffle", true, Some("Cmd+S")).unwrap(),
                        &MenuItem::with_id(app, "repeat", "Repeat", true, Some("Cmd+R")).unwrap(),
                    ]
                ).unwrap();

                let view_menu = Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[
                        &MenuItem::with_id(app, "now_playing", "Now Playing", true, Some("Cmd+1")).unwrap(),
                        &MenuItem::with_id(app, "search", "Search", true, Some("Cmd+2")).unwrap(),
                        &MenuItem::with_id(app, "library", "Library", true, Some("Cmd+3")).unwrap(),
                        &MenuItem::with_id(app, "queue", "Queue", true, Some("Cmd+4")).unwrap(),
                    ]
                ).unwrap();

                let menu = Menu::with_items(app, &[
                    &app_menu,
                    &playback_menu,
                    &view_menu,
                ]).unwrap();

                app.set_menu(menu).unwrap();

                app.on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "preferences" => { let _ = app.emit("menu:preferences", ()); }
                        "play_pause" => { let _ = app.emit("menu:play_pause", ()); }
                        "next_track" => { let _ = app.emit("menu:next_track", ()); }
                        "prev_track" => { let _ = app.emit("menu:prev_track", ()); }
                        "vol_up" => { let _ = app.emit("menu:vol_up", ()); }
                        "vol_down" => { let _ = app.emit("menu:vol_down", ()); }
                        "shuffle" => { let _ = app.emit("menu:shuffle", ()); }
                        "repeat" => { let _ = app.emit("menu:repeat", ()); }
                        "now_playing" => { let _ = app.emit("menu:now_playing", ()); }
                        "search" => { let _ = app.emit("menu:search", ()); }
                        "library" => { let _ = app.emit("menu:library", ()); }
                        "queue" => { let _ = app.emit("menu:queue", ()); }
                        _ => {}
                    }
                });
            }

            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::ExitRequested { api, .. } => {
                    api.prevent_exit();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        });
}
