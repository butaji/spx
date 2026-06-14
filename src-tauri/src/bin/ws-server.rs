// Standalone WebSocket server for SPX (network/dev mode)
// Starts the WebSocket server + Spotify backend without a Tauri window.

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    println!("SPX Backend starting on ws://0.0.0.0:1424");
    if let Err(e) = spx_lib::ws_server::run_server().await {
        tracing::error!("WS server error: {}", e);
    }
    println!("WS server stopped.");
}
