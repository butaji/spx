use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tauri::{AppHandle, Emitter};

static SERVER_STARTED: AtomicBool = AtomicBool::new(false);

pub fn start_oauth_callback_server(app_handle: AppHandle) {
    // Only start once
    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        tracing::info!("OAuth callback server already started");
        return;
    }

    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create runtime");

        runtime.block_on(async {
            let listener = match tokio::net::TcpListener::bind("127.0.0.1:1241").await {
                Ok(l) => {
                    tracing::info!("OAuth callback server listening on http://127.0.0.1:1241");
                    l
                }
                Err(e) => {
                    tracing::error!("Failed to bind to port 1241: {}", e);
                    SERVER_STARTED.store(false, Ordering::SeqCst);
                    return;
                }
            };

            loop {
                match listener.accept().await {
                    Ok((mut stream, _)) => {
                        let app = app_handle.clone();
                        tokio::spawn(async move {
                            let mut buffer = vec![0u8; 4096];
                            let n = match stream.read(&mut buffer).await {
                                Ok(n) if n > 0 => n,
                                _ => return,
                            };

                            let request = String::from_utf8_lossy(&buffer[..n]);
                            let lines: Vec<&str> = request.lines().collect();
                            
                            // Parse the callback URL from the first line
                            if let Some(first_line) = lines.first() {
                                if first_line.contains("GET") {
                                    if let Some(url_part) = first_line.split("GET ").nth(1) {
                                        let callback_path = url_part.split(' ').next().unwrap_or("");
                                        
                                        if callback_path.starts_with("/callback") {
                                            let full_url = format!("http://127.0.0.1:1241{}", callback_path);
                                            tracing::info!("OAuth callback received: {}", full_url);
                                            
                                            // Emit event to frontend
                                            let _ = app.emit("oauth-callback", full_url);
                                            
                                            // Send success response
                                            let response = "HTTP/1.1 200 OK\r\n\
                                                Content-Type: text/html\r\n\
                                                Connection: close\r\n\
                                                \r\n\
                                                <html><body>\
                                                <h2>Authentication Successful!</h2>\
                                                <p>You can close this window and return to SPX.</p>\
                                                <script>window.close();</script>\
                                                </body></html>";
                                            
                                            let _ = stream.write_all(response.as_bytes()).await;
                                            let _ = stream.shutdown().await;
                                            return;
                                        }
                                    }
                                }
                            }

                            // Default 404 for other routes
                            let response = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nNot Found";
                            let _ = stream.write_all(response.as_bytes()).await;
                            let _ = stream.shutdown().await;
                        });
                    }
                    Err(e) => {
                        tracing::error!("Failed to accept connection: {}", e);
                    }
                }
            }
        });
    });
}
