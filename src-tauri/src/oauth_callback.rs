use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use tauri::{AppHandle, Emitter};

static SERVER_STARTED: AtomicBool = AtomicBool::new(false);
static SERVER_LISTENING: AtomicBool = AtomicBool::new(false);

/// Start the OAuth callback server on the loopback address.
///
/// Uses a synchronous `std::net::TcpListener` in a dedicated thread so it does
/// not depend on the tokio runtime state. This matches the proven approach used
/// by `tauri-plugin-oauth`.
pub fn start_oauth_callback_server(app_handle: AppHandle) {
    // Only start once per app lifetime.
    if SERVER_STARTED.swap(true, Ordering::SeqCst) {
        tracing::info!("OAuth callback server already started");
        return;
    }

    thread::spawn(move || {
        let addrs: [SocketAddr; 2] = [
            SocketAddr::from(([127, 0, 0, 1], 1422)),
            SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], 1422)),
        ];

        let listener = match TcpListener::bind(&addrs[..]) {
            Ok(l) => l,
            Err(e) => {
                let msg = format!(
                    "Failed to bind OAuth callback server to 127.0.0.1:1422 / [::1]:1422: {}. \
                     Another process may be using port 1422.",
                    e
                );
                tracing::error!("{}", msg);
                let _ = app_handle.emit("oauth-callback-error", msg);
                SERVER_STARTED.store(false, Ordering::SeqCst);
                return;
            }
        };

        // Ensure the listener is non-blocking for accept() is not needed here;
        // incoming() blocks the thread until a connection arrives.
        SERVER_LISTENING.store(true, Ordering::SeqCst);
        tracing::info!("OAuth callback server listening on http://127.0.0.1:1422");

        for conn in listener.incoming() {
            match conn {
                Ok(mut stream) => {
                    let app = app_handle.clone();
                    thread::spawn(move || {
                        handle_connection(&mut stream, app);
                    });
                }
                Err(e) => {
                    tracing::error!("Failed to accept OAuth callback connection: {}", e);
                }
            }
        }
    });
}

/// Returns whether the OAuth callback server is actively listening.
pub fn is_callback_server_listening() -> bool {
    SERVER_LISTENING.load(Ordering::SeqCst)
}

fn handle_connection(stream: &mut TcpStream, app_handle: AppHandle) {
    let mut buffer = [0u8; 4096];
    let n = match stream.read(&mut buffer) {
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
                    let full_url = format!("http://127.0.0.1:1422{}", callback_path);
                    tracing::info!("OAuth callback received: {}", full_url);

                    // Emit event to frontend
                    let _ = app_handle.emit("oauth-callback", full_url);

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

                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.flush();
                    return;
                }
            }
        }
    }

    // Default 404 for other routes
    let response =
        "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nNot Found";
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}
