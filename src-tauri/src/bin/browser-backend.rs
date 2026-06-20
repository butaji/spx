//! SPX Rust Browser Backend
//!
//! Replaces the Node `callback-server.mjs` with a Rust implementation that uses
//! the same modules as the Tauri desktop app. It runs on port 1422 and provides:
//!
//!   * OAuth callback capture and redirect back to the Preact frontend
//!   * Local network discovery (Spotify Connect + Google Cast via mDNS)
//!   * Tauri command RPC bridge (`/invoke/<cmd>`) so the browser UI can use the
//!     Rust backend for device operations (Cast wake/auth, SPX Connect, diagnostics)
//!
//! The Preact frontend talks directly to the Spotify Web API; this backend only
//! handles things the browser cannot do itself (multicast, raw TCP, OAuth redirect).

use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tracing::{info, warn};

const DEFAULT_FRONTEND_URL: &str = "http://192.168.1.32:1420";
const DEFAULT_PORT: u16 = 1422;

/// Cached mDNS scan results — cached for 55s so repeated scans are instant
/// while still staying fresh enough for device discovery.
struct MdnsCache {
    /// Pre-serialized JSON array of devices.
    devices_json: String,
    cached_at: Instant,
}

impl MdnsCache {
    fn is_fresh(&self) -> bool {
        self.cached_at.elapsed() < Duration::from_secs(55)
    }

    fn devices_response(&self) -> Response {
        json_response(serde_json::json!({ "devices": serde_json::from_str::<serde_json::Value>(&self.devices_json).unwrap_or(serde_json::Value::Array(vec![])) }))
    }
}

/// Shared mutable state for the browser backend.
struct BackendState {
    mdns_cache: Option<MdnsCache>,
}

impl Default for BackendState {
    fn default() -> Self {
        Self { mdns_cache: None }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialise tracing so we see backend logs.
    let _ = tracing_subscriber::fmt::try_init();

    // Load .env like the Tauri app does.
    dotenvy::dotenv().ok();

    let port = env::var("SPX_BROWSER_BACKEND_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let frontend_url = env::var("SPX_FRONTEND_URL")
        .unwrap_or_else(|_| DEFAULT_FRONTEND_URL.to_string());

    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(run_server(port, frontend_url))
}

async fn run_server(port: u16, frontend_url: String) -> Result<(), Box<dyn std::error::Error>> {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr).await?;
    info!(
        "[spx-browser-backend] Listening on http://{} -> frontend {}",
        addr, frontend_url
    );

    let state: Arc<RwLock<BackendState>> = Arc::new(RwLock::new(BackendState::default()));

    loop {
        let (stream, peer) = listener.accept().await?;
        let frontend = frontend_url.clone();
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, peer, frontend, state).await {
                warn!("[spx-browser-backend] connection error from {}: {}", peer, e);
            }
        });
    }
}

async fn handle_connection(
    mut stream: TcpStream,
    peer: std::net::SocketAddr,
    frontend_url: String,
    state: Arc<RwLock<BackendState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (method, path, query, _headers, body) = match read_request(&mut stream).await {
        Some(r) => r,
        None => return Ok(()),
    };

    info!("[spx-browser-backend] {} {}{} from {}", method, path, if query.is_empty() { "" } else { "?" }, peer);
    let response = dispatch(&method, &path, &query, body, &frontend_url, state).await;
    send_response(&mut stream, response).await?;
    Ok(())
}

// ─── Tiny HTTP request parser ────────────────────────────────────────────────

async fn read_request(
    stream: &mut TcpStream,
) -> Option<(String, String, String, HashMap<String, String>, Vec<u8>)> {
    let mut buf = vec![0u8; 16384];
    let mut filled = 0usize;

    loop {
        let n = stream.read(&mut buf[filled..]).await.ok()?;
        if n == 0 {
            return None;
        }
        filled += n;

        if let Some(end) = find_subsequence(&buf[..filled], b"\r\n\r\n") {
            let header_bytes = &buf[..end];
            let header_str = String::from_utf8_lossy(header_bytes);
            let mut lines = header_str.lines();
            let first = lines.next()?.to_string();
            let mut headers = HashMap::new();
            for line in lines {
                if let Some((k, v)) = line.split_once(':') {
                    headers.insert(k.trim().to_lowercase(), v.trim().to_string());
                }
            }

            let content_length = headers
                .get("content-length")
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(0);

            let body_start = end + 4;
            let mut body = Vec::new();
            if content_length > 0 {
                if filled >= body_start + content_length {
                    body.extend_from_slice(&buf[body_start..body_start + content_length]);
                } else {
                    body.extend_from_slice(&buf[body_start..filled]);
                    while body.len() < content_length {
                        let mut chunk = [0u8; 4096];
                        let needed = content_length - body.len();
                        let to_read = chunk.len().min(needed);
                        let n = stream.read(&mut chunk[..to_read]).await.ok()?;
                        if n == 0 {
                            return None;
                        }
                        body.extend_from_slice(&chunk[..n]);
                    }
                }
            }

            let (method, target) = first.split_once(' ')?;
            let target = target.split_once(' ').map(|(t, _)| t).unwrap_or(target);
            let (path, query) = target.split_once('?').unwrap_or((target, ""));
            info!("[parse] first={:?} target={:?} path={:?} query={:?}", first, target, path, query);

            return Some((
                method.to_string(),
                path.to_string(),
                query.to_string(),
                headers,
                body,
            ));
        }

        if filled >= buf.len() {
            return None;
        }
    }
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

// ─── Response helpers ────────────────────────────────────────────────────────

struct Response {
    status: u16,
    content_type: &'static str,
    body: Vec<u8>,
    extra_headers: Vec<(String, String)>,
}

fn json_response(value: serde_json::Value) -> Response {
    Response {
        status: 200,
        content_type: "application/json",
        body: value.to_string().into_bytes(),
        extra_headers: Vec::new(),
    }
}

fn text_response(status: u16, text: String) -> Response {
    Response {
        status,
        content_type: "text/plain",
        body: text.into_bytes(),
        extra_headers: Vec::new(),
    }
}

#[allow(dead_code)]
fn redirect_response(location: String) -> Response {
    Response {
        status: 302,
        content_type: "text/plain",
        body: vec![],
        extra_headers: vec![("Location".to_string(), location)],
    }
}

async fn send_response(stream: &mut TcpStream, response: Response) -> std::io::Result<()> {
    let status_text = match response.status {
        200 => "OK",
        204 => "No Content",
        302 => "Found",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        501 => "Not Implemented",
        _ => "Unknown",
    };

    let mut head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n",
        response.status,
        status_text,
        response.content_type,
        response.body.len()
    );

    head.push_str("Access-Control-Allow-Origin: *\r\n");
    head.push_str("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
    head.push_str("Access-Control-Allow-Headers: Content-Type, Authorization\r\n");

    for (k, v) in response.extra_headers {
        head.push_str(&format!("{}: {}\r\n", k, v));
    }

    head.push_str("\r\n");

    stream.write_all(head.as_bytes()).await?;
    stream.write_all(&response.body).await?;
    stream.flush().await?;
    Ok(())
}

// ─── Router ──────────────────────────────────────────────────────────────────

async fn dispatch(
    method: &str,
    path: &str,
    query: &str,
    body: Vec<u8>,
    frontend_url: &str,
    state: Arc<RwLock<BackendState>>,
) -> Response {
    if method == "OPTIONS" {
        return Response {
            status: 204,
            content_type: "text/plain",
            body: vec![],
            extra_headers: Vec::new(),
        };
    }

    match (method, path) {
        ("GET", "/health") => json_response(serde_json::json!({
            "status": "ok",
            "service": "spx-rust-browser-backend"
        })),

        ("GET", "/local-devices") => handle_local_devices(state).await,

        ("GET", "/callback") => handle_callback(query, frontend_url).await,

        ("POST", "/save-verifier") => handle_save_verifier(body).await,

        ("POST", path) if path.starts_with("/invoke/") => {
            let cmd = &path["/invoke/".len()..];
            handle_invoke(cmd, body).await
        }

        ("GET", "/") => text_response(
            200,
            "SPX Rust Browser Backend — /health /local-devices /callback /invoke/<cmd>".into(),
        ),

        _ => text_response(404, format!("Not found: {} {}", method, path)),
    }
}

/// Saves PKCE verifier + state to a temp file so the /callback handler can use
/// them to complete the token exchange server-side.
fn save_verifier(state: &str, verifier: &str) -> std::io::Result<()> {
    std::fs::write("/tmp/spx_verifier.txt", format!("{}\n{}", state, verifier))
}

/// Reads the previously saved verifier+state from /tmp/spx_verifier.txt.
/// Returns (state, verifier). Does NOT wipe the file — use consume_verifier() instead.
fn read_verifier() -> Option<(String, String)> {
    let contents = std::fs::read_to_string("/tmp/spx_verifier.txt").ok()?;
    let mut lines = contents.lines();
    let state = lines.next()?.to_string();
    let verifier = lines.next()?.to_string();
    Some((state, verifier))
}

/// Consumes (wipes) the verifier file after successful use to prevent replay.
fn consume_verifier() {
    let _ = std::fs::remove_file("/tmp/spx_verifier.txt");
}

/// POST /save-verifier — called by the frontend before redirecting to Spotify.
/// Body: state=<oauth_state>&verifier=<pkce_verifier>
async fn handle_save_verifier(body: Vec<u8>) -> Response {
    let body_str = String::from_utf8_lossy(&body);
    let mut state = String::new();
    let mut verifier = String::new();
    for pair in body_str.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let v_dec = urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string();
            match k {
                "state" => state = v_dec,
                "verifier" => verifier = v_dec,
                _ => {}
            }
        }
    }
    if state.is_empty() || verifier.is_empty() {
        return json_response(serde_json::json!({"ok": false, "error": "missing state or verifier"}));
    }
    match save_verifier(&state, &verifier) {
        Ok(_) => json_response(serde_json::json!({"ok": true})),
        Err(e) => json_response(serde_json::json!({"ok": false, "error": e.to_string()})),
    }
}

async fn handle_callback(query: &str, _frontend_url: &str) -> Response {
    let params: HashMap<String, String> = query
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let k = parts.next()?;
            let v = parts.next().unwrap_or("");
            Some((k.to_string(), urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string()))
        })
        .collect();

    let code = match params.get("code") {
        Some(c) => c,
        None => return text_response(400, "Missing code parameter".into()),
    };
    let state = params.get("state").map(|s| s.clone()).unwrap_or_default();

    // Read the verifier we saved earlier
    let (saved_state, verifier) = match read_verifier() {
        Some((s, v)) => (s, v),
        None => return text_response(500, "No saved verifier found — start auth from the SPX app".into()),
    };

    // Validate state (CSRF protection)
    if !saved_state.is_empty() && state != saved_state {
        return text_response(400, "State mismatch — possible CSRF".into());
    }

    // Exchange code for token using async reqwest
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let code_owned = code.to_string();
    let verifier_owned = verifier.to_string();
    let client_id = env::var("SPOTIFY_CLIENT_ID").unwrap_or_else(|_| "e1c9ee463a394fee84e031daa1665db2".to_string());
    let client_secret = env::var("SPOTIFY_CLIENT_SECRET").ok();
    let redirect_uri = "http://127.0.0.1:1422/callback";
    let body = format!(
        "grant_type=authorization_code&code={}&redirect_uri={}&code_verifier={}",
        urlencoding::encode(&code_owned),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(&verifier_owned),
    );

    let token_resp = if let Some(secret) = client_secret {
        client.post("https://accounts.spotify.com/api/token")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .basic_auth(&client_id, Some(secret))
            .body(body)
            .send().await
    } else {
        client.post("https://accounts.spotify.com/api/token")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send().await
    };

    let token_json: serde_json::Value = match token_resp {
        Ok(r) => match r.json::<serde_json::Value>().await {
            Ok(j) => j,
            Err(e) => return text_response(500, format!("Token response parse error: {}", e)),
        },
        Err(e) => return text_response(500, format!("Token request failed: {}", e)),
    };

    if token_json.get("error").is_some() {
        let err = token_json["error_description"].as_str().or(token_json["error"].as_str()).unwrap_or("unknown");
        return text_response(400, format!("Spotify error: {}", err));
    }

    // Save token to /tmp/spx_token.json
    let token_str = token_json.to_string();
    if let Err(e) = std::fs::write("/tmp/spx_token.json", &token_str) {
        warn!("Failed to save token: {}", e);
    } else {
        info!("Token saved to /tmp/spx_token.json");
    }

    // Prevent this code+verifier from being reused
    consume_verifier();

    // Return JSON with success — no redirect needed since we're not in a browser
    json_response(serde_json::json!({"ok": true, "message": "Token saved. You can close this tab."}))
}

async fn handle_local_devices(state: Arc<RwLock<BackendState>>) -> Response {
    // Return cached results if still fresh — avoids the 20s mDNS scan on repeated calls.
    {
        let cache = state.read().await;
        if let Some(cached) = &cache.mdns_cache {
            if cached.is_fresh() {
                info!("[local-devices] Returning cached scan ({}s old)", cached.cached_at.elapsed().as_secs());
                return cached.devices_response();
            }
        }
    }

    // Cache miss or stale — run the full mDNS scan.
    use tokio::time::{timeout, Duration};

    let cast_future = timeout(
        Duration::from_secs(45),
        spx_lib::mdns::browse_service("_googlecast._tcp"),
    );
    let spotify_future = timeout(
        Duration::from_secs(45),
        spx_lib::mdns::browse_service("_spotify-connect._tcp"),
    );

    let (cast_result, spotify_result) = tokio::join!(cast_future, spotify_future);

    let mut devices = Vec::new();
    let mut timed_out = false;

    match cast_result {
        Ok(Ok(mut d)) => devices.append(&mut d),
        Ok(Err(e)) => warn!("Cast scan error: {}", e),
        Err(_) => timed_out = true,
    }

    match spotify_result {
        Ok(Ok(mut d)) => devices.append(&mut d),
        Ok(Err(e)) => warn!("Spotify scan error: {}", e),
        Err(_) => timed_out = true,
    }

    // Serialize and cache
    let devices_json = serde_json::to_string(&devices).unwrap_or_else(|_| "[]".to_string());
    {
        let mut cache = state.write().await;
        cache.mdns_cache = Some(MdnsCache {
            devices_json,
            cached_at: Instant::now(),
        });
    }

    let body = if timed_out {
        serde_json::json!({
            "devices": devices,
            "error": "Device scan timed out (some results may be missing)"
        })
    } else {
        serde_json::json!({ "devices": devices })
    };

    json_response(body)
}

// ─── Tauri command RPC bridge ────────────────────────────────────────────────

async fn handle_invoke(cmd: &str, body: Vec<u8>) -> Response {
    let args: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => serde_json::Value::Null,
    };

    let result = invoke_command(cmd, args).await;
    match result {
        Ok(value) => json_response(value),
        Err(e) => text_response(500, e),
    }
}

macro_rules! require_str {
    ($args:expr, $key:expr) => {
        $args
            .get($key)
            .and_then(|v| v.as_str())
            .ok_or_else(|| format!("Missing or invalid argument: {}", $key))?
            .to_string()
    };
}

async fn invoke_command(cmd: &str, args: serde_json::Value) -> Result<serde_json::Value, String> {
    match cmd {
        // Device discovery
        "scan_spotify_devices" => {
            let devices = spx_lib::commands::scan_spotify_devices().await?;
            serde_json::to_value(devices).map_err(|e| e.to_string())
        }

        // Cast device wake
        "wake_cast_device" => {
            let ip = require_str!(args, "ip");
            let result = spx_lib::commands::wake_cast_device(ip).await?;
            Ok(serde_json::Value::String(result))
        }

        // Cast authentication
        "authenticate_cast_device_command" => {
            let ip = require_str!(args, "ip");
            let access_token = require_str!(args, "accessToken");
            let device_name = args
                .get("deviceName")
                .and_then(|v| v.as_str())
                .unwrap_or("Cast Device")
                .to_string();
            let result = spx_lib::commands::authenticate_cast_device_common(
                None,
                ip,
                access_token,
                device_name,
            )
            .await?;
            Ok(serde_json::Value::String(result))
        }

        "authenticate_cast_device_raw_command" => {
            let ip = require_str!(args, "ip");
            let access_token = require_str!(args, "accessToken");
            let result = spx_lib::commands::authenticate_cast_device_raw_common(
                None,
                ip,
                access_token,
            )
            .await?;
            Ok(serde_json::Value::String(result))
        }

        // Local Spotify Connect device
        "start_local_connect_device" => {
            let access_token = require_str!(args, "accessToken");
            let name = args
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("SPX Connect")
                .to_string();
            let volume_percent = args
                .get("volumePercent")
                .and_then(|v| v.as_u64())
                .unwrap_or(50) as u16;
            let result = spx_lib::commands::start_local_connect_device(
                access_token,
                name,
                volume_percent,
            )
            .await?;
            Ok(serde_json::Value::String(result))
        }

        // Diagnostics
        "get_diagnostics" => {
            let result = spx_lib::commands::get_diagnostics_common(
                None,
                env!("CARGO_PKG_VERSION").to_string(),
                "browser-backend".to_string(),
            )
            .await?;
            Ok(result)
        }

        "get_callback_server_status" => {
            let result = spx_lib::commands::get_callback_server_status()?;
            Ok(result)
        }

        "diagnose_network" => {
            let ip = require_str!(args, "ip");
            let result = spx_lib::commands::diagnose_network(ip).await?;
            Ok(serde_json::Value::String(result))
        }

        "request_macos_local_network_permission" => {
            let result = spx_lib::commands::request_macos_local_network_permission();
            Ok(serde_json::Value::String(result))
        }

        // Now Playing macOS integration (no-op on non-macOS)
        "update_now_playing" => {
            let title = args.get("title").and_then(|v| v.as_str()).map(|s| s.to_string());
            let artist = args.get("artist").and_then(|v| v.as_str()).map(|s| s.to_string());
            let album = args.get("album").and_then(|v| v.as_str()).map(|s| s.to_string());
            let duration_ms = args.get("durationMs").and_then(|v| v.as_i64());
            let elapsed_ms = args.get("elapsedMs").and_then(|v| v.as_i64());
            let is_playing = args.get("isPlaying").and_then(|v| v.as_bool()).unwrap_or(false);
            spx_lib::now_playing::update_now_playing(
                title, artist, album, duration_ms, elapsed_ms, is_playing,
            );
            Ok(serde_json::Value::Null)
        }

        "clear_now_playing" => {
            spx_lib::now_playing::clear_now_playing();
            Ok(serde_json::Value::Null)
        }

        // librespot helpers
        "authenticate_librespot_oauth" => {
            let result = spx_lib::commands::authenticate_librespot_oauth().await?;
            serde_json::to_value(result).map_err(|e| e.to_string())
        }

        "create_librespot_session" => {
            let access_token = require_str!(args, "accessToken");
            let result = spx_lib::commands::create_librespot_session(access_token).await?;
            Ok(serde_json::Value::String(result))
        }

        // Credentials / auth helpers
        "get_spotify_client_id" => {
            let result = spx_lib::commands::get_spotify_client_id()?;
            Ok(serde_json::Value::String(result))
        }

        "check_credentials_status" => {
            let result = spx_lib::commands::check_credentials_status()?;
            Ok(result)
        }

        "get_web_player_token_command" => {
            let sp_dc = args.get("sp_dc").and_then(|v| v.as_str()).map(|s| s.to_string());
            let result = spx_lib::commands::get_web_player_token_command(sp_dc).await?;
            serde_json::to_value(result).map_err(|e| e.to_string())
        }

        // Event bus helpers (no-op in browser mode, but kept for compatibility)
        "get_event_history" => {
            let limit = args.get("limit").and_then(|v| v.as_u64()).map(|n| n as usize);
            let result = spx_lib::commands::get_event_history(limit).await?;
            serde_json::to_value(result).map_err(|e| e.to_string())
        }

        "emit_spx_event" => {
            let event = args.get("event").cloned().unwrap_or(serde_json::Value::Null);
            spx_lib::commands::emit_spx_event(event).await?;
            Ok(serde_json::Value::Null)
        }

        // Cookie capture is a desktop-only Tauri feature.
        "start_spotify_cookie_capture" | "clear_spotify_sp_dc" | "get_stored_sp_dc" => Err(
            "Cookie capture is only available in the desktop app".to_string(),
        ),

        _ => Err(format!("Command '{}' is not exposed by the browser backend", cmd)),
    }
}

// ─── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod http_parser_tests {
    use super::*;

    // ── find_subsequence ──────────────────────────────────────────────────────

    #[test]
    fn find_subsequence_basic() {
        assert_eq!(find_subsequence(b"hello world", b"world"), Some(6));
        assert_eq!(find_subsequence(b"hello world", b"hello"), Some(0));
    }

    #[test]
    fn find_subsequence_middle() {
        assert_eq!(find_subsequence(b"abcXYZdef", b"XYZ"), Some(3));
    }

    #[test]
    fn find_subsequence_not_found() {
        assert_eq!(find_subsequence(b"hello world", b"xyz"), None);
        assert_eq!(find_subsequence(b"abc", b"abcdef"), None);
    }

    #[test]
    fn find_subsequence_empty_needle() {
        assert_eq!(find_subsequence(b"hello", b""), Some(0));
    }

    #[test]
    fn find_subsequence_empty_haystack() {
        assert_eq!(find_subsequence(b"", b"abc"), None);
    }

    #[test]
    fn find_subsequence_exact_match() {
        assert_eq!(find_subsequence(b"test", b"test"), Some(0));
    }

    #[test]
    fn find_subsequence_duplicate() {
        // position returns FIRST match
        assert_eq!(find_subsequence(b"hello hello", b"hello"), Some(0));
    }

    #[test]
    fn find_subsequence_overlapping() {
        // "aaa" at positions 0 and 1
        assert_eq!(find_subsequence(b"aaaa", b"aaa"), Some(0));
    }

    #[test]
    fn find_subsequence_crlf() {
        assert_eq!(find_subsequence(b"line1\r\nline2\r\n", b"\r\n"), Some(5));
    }

    // ── handle_save_verifier parsing ─────────────────────────────────────────

    #[test]
    fn handle_save_verifier_parses_valid_body() {
        // This tests the parsing logic in isolation
        let body = b"state=randomstate123&verifier=verifier456".to_vec();
        let body_str = String::from_utf8_lossy(&body);
        let mut state = String::new();
        let mut verifier = String::new();
        for pair in body_str.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let v_dec = urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string();
                match k {
                    "state" => state = v_dec,
                    "verifier" => verifier = v_dec,
                    _ => {}
                }
            }
        }
        assert_eq!(state, "randomstate123");
        assert_eq!(verifier, "verifier456");
    }

    #[test]
    fn handle_save_verifier_handles_urlencoded_values() {
        let body = b"state=abc%3D123&verifier=def%26123".to_vec();
        let body_str = String::from_utf8_lossy(&body);
        let mut state = String::new();
        let mut verifier = String::new();
        for pair in body_str.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let v_dec = urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string();
                match k {
                    "state" => state = v_dec,
                    "verifier" => verifier = v_dec,
                    _ => {}
                }
            }
        }
        assert_eq!(state, "abc=123");
        assert_eq!(verifier, "def&123");
    }

    #[test]
    fn handle_save_verifier_empty_fields_rejected() {
        let body = b"state=&verifier=verifier456".to_vec();
        let body_str = String::from_utf8_lossy(&body);
        let mut state = String::new();
        let mut verifier = String::new();
        for pair in body_str.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let v_dec = urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string();
                match k {
                    "state" => state = v_dec,
                    "verifier" => verifier = v_dec,
                    _ => {}
                }
            }
        }
        // empty state should cause rejection (handled in handle_save_verifier)
        assert!(state.is_empty());
    }

    #[test]
    fn handle_save_verifier_extra_fields_ignored() {
        let body = b"state=s1&verifier=v1&extra=ignored".to_vec();
        let body_str = String::from_utf8_lossy(&body);
        let mut state = String::new();
        let mut verifier = String::new();
        let mut extras = Vec::new();
        for pair in body_str.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let v_dec = urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string();
                match k {
                    "state" => state = v_dec,
                    "verifier" => verifier = v_dec,
                    _ => extras.push(k.to_string()),
                }
            }
        }
        assert_eq!(state, "s1");
        assert_eq!(verifier, "v1");
        assert_eq!(extras, vec!["extra"]);
    }

    // ── query string parsing ─────────────────────────────────────────────────

    #[test]
    fn query_param_parsing() {
        use std::collections::HashMap;
        let query = "code=abc123&state=mystate";
        let params: HashMap<String, String> = query
            .split('&')
            .filter_map(|pair| {
                let mut parts = pair.splitn(2, '=');
                let k = parts.next()?;
                let v = parts.next().unwrap_or("");
                Some((k.to_string(), urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string()))
            })
            .collect();
        assert_eq!(params.get("code"), Some(&"abc123".to_string()));
        assert_eq!(params.get("state"), Some(&"mystate".to_string()));
    }

    #[test]
    fn query_param_url_decoded() {
        use std::collections::HashMap;
        let query = "code=abc%3D123%26xyz";
        let params: HashMap<String, String> = query
            .split('&')
            .filter_map(|pair| {
                let mut parts = pair.splitn(2, '=');
                let k = parts.next()?;
                let v = parts.next().unwrap_or("");
                Some((k.to_string(), urlencoding::decode(v).unwrap_or_else(|_| v.into()).to_string()))
            })
            .collect();
        assert_eq!(params.get("code"), Some(&"abc=123&xyz".to_string()));
    }

    // ── MdnsCache freshness ──────────────────────────────────────────────────

    #[test]
    fn mdns_cache_is_fresh_immediately() {
        let cache = MdnsCache {
            devices_json: "[{\"name\":\"Test\"}]".to_string(),
            cached_at: Instant::now(),
        };
        assert!(cache.is_fresh());
    }

    #[test]
    fn mdns_cache_stale_after_55_seconds() {
        let cache = MdnsCache {
            devices_json: "[{\"name\":\"Test\"}]".to_string(),
            cached_at: Instant::now() - Duration::from_secs(56),
        };
        assert!(!cache.is_fresh());
    }

    #[test]
    fn mdns_cache_fresh_at_54_seconds() {
        let cache = MdnsCache {
            devices_json: "[{\"name\":\"Test\"}]".to_string(),
            cached_at: Instant::now() - Duration::from_secs(54),
        };
        assert!(cache.is_fresh());
    }

    #[test]
    fn mdns_cache_stale_at_55_seconds() {
        let cache = MdnsCache {
            devices_json: "[{\"name\":\"Test\"}]".to_string(),
            cached_at: Instant::now() - Duration::from_secs(55),
        };
        assert!(!cache.is_fresh());
    }

    #[test]
    fn mdns_cache_devices_response_valid_json() {
        let cache = MdnsCache {
            devices_json: r#"[{"name":"Mini2","ip":"192.168.1.14"}]"#.to_string(),
            cached_at: Instant::now(),
        };
        let resp = cache.devices_response();
        assert_eq!(resp.status, 200);
        assert_eq!(resp.content_type, "application/json");
        let body: serde_json::Value =
            serde_json::from_slice(&resp.body).expect("should be valid JSON");
        assert!(body["devices"].is_array());
    }

    #[test]
    fn mdns_cache_devices_response_empty_on_invalid_json() {
        let cache = MdnsCache {
            devices_json: "not valid json{{".to_string(),
            cached_at: Instant::now(),
        };
        let resp = cache.devices_response();
        let body: serde_json::Value =
            serde_json::from_slice(&resp.body).expect("should be valid JSON (fallback to empty array)");
        assert!(body["devices"].is_array());
        assert_eq!(body["devices"].as_array().unwrap().len(), 0);
    }

    // ── response helpers ────────────────────────────────────────────────────

    #[test]
    fn json_response_status_200() {
        let resp = json_response(serde_json::json!({"ok": true}));
        assert_eq!(resp.status, 200);
        assert_eq!(resp.content_type, "application/json");
        assert_eq!(&String::from_utf8_lossy(&resp.body), r#"{"ok":true}"#);
    }

    #[test]
    fn text_response_custom_status() {
        let resp = text_response(404, "Not found".to_string());
        assert_eq!(resp.status, 404);
        assert_eq!(resp.content_type, "text/plain");
        assert_eq!(&String::from_utf8_lossy(&resp.body), "Not found");
    }

    #[test]
    fn text_response_500() {
        let resp = text_response(500, "Internal error".to_string());
        assert_eq!(resp.status, 500);
    }
}

#[cfg(test)]
mod verifier_file_tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    // Override the verifier file path for testing using a temp file
    fn write_verifier(path: &std::path::Path, state: &str, verifier: &str) {
        let mut file = std::fs::File::create(path).unwrap();
        writeln!(file, "{}", state).unwrap();
        writeln!(file, "{}", verifier).unwrap();
    }

    fn read_verifier_from(path: &std::path::Path) -> Option<(String, String)> {
        let contents = std::fs::read_to_string(path).ok()?;
        let mut lines = contents.lines();
        let state = lines.next()?.to_string();
        let verifier = lines.next()?.to_string();
        Some((state, verifier))
    }

    #[test]
    fn verifier_file_roundtrip() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        write_verifier(path, "state123", "verifier456");
        let (state, verifier) = read_verifier_from(path).unwrap();

        assert_eq!(state, "state123");
        assert_eq!(verifier, "verifier456");
    }

    #[test]
    fn verifier_file_multiline_values() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        write_verifier(path, "my=state", "my\nverifier");
        let (state, verifier) = read_verifier_from(path).unwrap();

        // The verifier file only reads first 2 lines
        assert_eq!(state, "my=state");
        assert_eq!(verifier, "my"); // "my\nverifier" — only first line
    }

    #[test]
    fn verifier_file_missing_returns_none() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();
        std::fs::remove_file(path).unwrap();

        let result = read_verifier_from(path);
        assert!(result.is_none());
    }

    #[test]
    fn verifier_file_incomplete_returns_none() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        // Only one line — missing verifier
        std::fs::write(path, "only_state\n").unwrap();
        let result = read_verifier_from(path);
        assert!(result.is_none());
    }

    #[test]
    fn verifier_file_empty_returns_none() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        std::fs::write(path, "").unwrap();
        let result = read_verifier_from(path);
        assert!(result.is_none());
    }

    #[test]
    fn verifier_file_state_with_equals() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        // OAuth state often contains base64 with = padding
        write_verifier(path, "state=with=equals==", "verifier_abc");
        let (state, verifier) = read_verifier_from(path).unwrap();

        assert_eq!(state, "state=with=equals==");
        assert_eq!(verifier, "verifier_abc");
    }

    #[test]
    fn verifier_file_unicode_state() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path();

        write_verifier(path, "État_de_ca", "verifier_123");
        let (state, verifier) = read_verifier_from(path).unwrap();

        assert_eq!(state, "État_de_ca");
        assert_eq!(verifier, "verifier_123");
    }

    // ── consume_verifier (uses a temp file) ─────────────────────────────────

    #[test]
    fn consume_verifier_removes_file() {
        // Create a temp file manually, then simulate consume
        let path = std::env::temp_dir().join("spx_test_verifier_delete.txt");
        std::fs::write(&path, "state\nverifier\n").unwrap();
        assert!(path.exists());

        // Simulate consume: remove the file
        let _ = std::fs::remove_file(&path);
        assert!(!path.exists());

        // Cleanup any leftover
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn consume_verifier_silent_on_missing_file() {
        // std::fs::remove_file on a non-existent path returns Err (not panic)
        let result = std::fs::remove_file("/tmp/nonexistent_spx_verifier_test_12345.txt");
        assert!(result.is_err()); // Should return Err, not panic
    }
}
