use std::println;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_spotify_client_id, start_callback_server, is_mock_mode])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
