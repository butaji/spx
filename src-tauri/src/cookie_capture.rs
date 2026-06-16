//! Embedded WebView flow that captures the `sp_dc` cookie from Spotify's web
//! player. The cookie is required to obtain a Web Player access token, which
//! is the only token Google Cast receivers accept.

use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreExt;
use tracing::{info, warn};

const SPOTIFY_LOGIN_URL: &str =
    "https://accounts.spotify.com/en/login?continue=https%3A%2F%2Fopen.spotify.com%2F";
const STORE_KEY: &str = "spotify_sp_dc";
const WINDOW_LABEL: &str = "spotify-cookie-capture";

/// Start an embedded WebView that loads the Spotify login page and polls for
/// the `sp_dc` cookie. When found, the cookie is saved to the Tauri store and
/// emitted as an event.
///
/// If a capture window is already open, this returns an error so the caller can
/// bring the existing window to the front instead.
pub async fn start_cookie_capture<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<String, String> {
    // If we already have a valid cookie, skip the login flow.
    if let Ok(sp_dc) = load_sp_dc(&app).await {
        if !sp_dc.is_empty() {
            info!("sp_dc cookie already present in store; skipping capture");
            return Ok("Cookie already present".to_string());
        }
    }

    // Close any stale capture window.
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.close();
    }

    let window = tauri::WebviewWindowBuilder::new(
        &app,
        WINDOW_LABEL,
        tauri::WebviewUrl::External(SPOTIFY_LOGIN_URL.parse().map_err(|e| format!("invalid url: {e}"))?),
    )
    .title("Spotify Login — Cast support")
    .inner_size(800.0, 700.0)
    .center()
    .build()
    .map_err(|e| format!("failed to open capture window: {e}"))?;

    // Spawn a background task that polls cookies.
    let app_for_task = app.clone();
    tauri::async_runtime::spawn(async move {
        poll_for_sp_dc(app_for_task, window).await;
    });

    Ok("Spotify login window opened. Cookie capture is running in the background.".to_string())
}

/// Poll the capture window's cookies until `sp_dc` is found or the window is
/// closed.
async fn poll_for_sp_dc<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: tauri::WebviewWindow<R>) {
    let mut found = false;
    for attempt in 1..=150 {
        // 150 * 2s = 5 minutes max.
        tokio::time::sleep(Duration::from_secs(2)).await;

        match window.cookies() {
            Ok(cookies) => {
                for cookie in cookies {
                    if cookie.name() == "sp_dc" && !cookie.value().is_empty() {
                        let sp_dc = cookie.value().to_string();
                        info!(
                            "Captured sp_dc cookie (domain={}, attempt={})",
                            cookie.domain().unwrap_or("unknown"),
                            attempt
                        );
                        if let Err(e) = save_sp_dc(&app, &sp_dc).await {
                            warn!("Failed to save sp_dc cookie: {e}");
                        } else {
                            let _ = app.emit("spotify:sp-dc-captured", &sp_dc);
                            found = true;
                        }
                        let _ = window.close();
                        break;
                    }
                }
            }
            Err(e) => {
                warn!("Failed to read cookies (attempt {}): {}", attempt, e);
            }
        }

        if found {
            break;
        }
    }

    if !found {
        info!("sp_dc cookie capture timed out");
        let _ = app.emit("spotify:sp-dc-timeout", ());
    }
}

/// Save `sp_dc` to the Tauri store.
async fn save_sp_dc<R: tauri::Runtime>(app: &tauri::AppHandle<R>, sp_dc: &str) -> Result<(), String> {
    let store = app
        .store("store.json")
        .map_err(|e| format!("failed to open store: {e}"))?;
    store.set(STORE_KEY, serde_json::Value::String(sp_dc.to_string()));
    store
        .save()
        .map_err(|e| format!("failed to save store: {e}"))?;
    Ok(())
}

/// Load `sp_dc` from the Tauri store.
pub async fn load_sp_dc<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<String, String> {
    let store = app
        .store("store.json")
        .map_err(|e| format!("failed to open store: {e}"))?;
    match store.get(STORE_KEY) {
        Some(serde_json::Value::String(s)) if !s.is_empty() => Ok(s),
        _ => Err("sp_dc not found in store".to_string()),
    }
}

/// Check whether a non-empty `sp_dc` cookie is stored.
pub async fn has_stored_sp_dc<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<bool, String> {
    let store = app
        .store("store.json")
        .map_err(|e| format!("failed to open store: {e}"))?;
    Ok(matches!(store.get(STORE_KEY), Some(serde_json::Value::String(s)) if !s.is_empty()))
}

/// Delete the stored `sp_dc` cookie.
pub async fn clear_sp_dc<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let store = app
        .store("store.json")
        .map_err(|e| format!("failed to open store: {e}"))?;
    store.delete(STORE_KEY);
    store
        .save()
        .map_err(|e| format!("failed to save store: {e}"))?;
    Ok(())
}
