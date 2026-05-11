pub mod spotify;

use serde_json::Value;
use spotify::{mock, SpotifyClient};
use tauri::{Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;

pub struct AppState {
    pub mock: bool,
    pub spotify: tokio::sync::Mutex<SpotifyClient>,
    pub refresh_token: tokio::sync::Mutex<Option<String>>,
}

fn parse_deep_link(url: &str) -> Option<(String, String)> {
    let url = url.strip_prefix("com.spx.app://callback?")?;
    let mut code = None;
    let mut state = None;
    for param in url.split('&') {
        let mut parts = param.split('=');
        let key = parts.next()?;
        let value = parts.next()?;
        match key {
            "code" => code = Some(value.to_string()),
            "state" => state = Some(value.to_string()),
            _ => {}
        }
    }
    let code = code?;
    let state = state?;
    Some((code, state))
}

#[tauri::command]
fn is_mock_mode(state: State<'_, AppState>) -> bool {
    state.mock
}

#[tauri::command]
async fn spotify_auth_url(state: State<'_, AppState>) -> Result<String, String> {
    if state.mock { return Ok("mock://auth".to_string()); }
    let client = state.spotify.lock().await;
    Ok(client.get_auth_url())
}

#[tauri::command]
async fn spotify_handle_callback(state: State<'_, AppState>, code: String, state_param: String) -> Result<(), String> {
    if state.mock { return Ok(()); }
    let mut client = state.spotify.lock().await;
    let token_info = client.exchange_code(code, state_param).await?;
    *state.refresh_token.lock().await = token_info.refresh_token;
    Ok(())
}

#[tauri::command]
async fn spotify_refresh_token(state: State<'_, AppState>) -> Result<(), String> {
    if state.mock { return Ok(()); }
    let refresh_token = state.refresh_token.lock().await.clone();
    let refresh_token = refresh_token.ok_or("No refresh token available. Please authenticate first.")?;
    let mut client = state.spotify.lock().await;
    client.refresh_access_token(&refresh_token).await
}

#[tauri::command]
async fn spotify_playback(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::playback_state()); }
    let client = state.spotify.lock().await;
    client.get_playback_state().await
}

#[tauri::command]
async fn spotify_play(state: State<'_, AppState>) -> Result<(), String> {
    if state.mock { mock::play(); return Ok(()); }
    let client = state.spotify.lock().await;
    client.play().await
}

#[tauri::command]
async fn spotify_pause(state: State<'_, AppState>) -> Result<(), String> {
    if state.mock { mock::pause(); return Ok(()); }
    let client = state.spotify.lock().await;
    client.pause().await
}

#[tauri::command]
async fn spotify_next(state: State<'_, AppState>) -> Result<(), String> {
    if state.mock { mock::next(); return Ok(()); }
    let client = state.spotify.lock().await;
    client.next().await
}

#[tauri::command]
async fn spotify_previous(state: State<'_, AppState>) -> Result<(), String> {
    if state.mock { mock::previous(); return Ok(()); }
    let client = state.spotify.lock().await;
    client.previous().await
}

#[tauri::command]
async fn spotify_seek(state: State<'_, AppState>, position_ms: u32) -> Result<(), String> {
    if state.mock { mock::seek(position_ms); return Ok(()); }
    const MAX_POSITION_MS: u32 = 86400000; // 24 hours in ms
    if position_ms > MAX_POSITION_MS {
        return Err(format!("position_ms must be <= {} (24 hours)", MAX_POSITION_MS));
    }
    let client = state.spotify.lock().await;
    client.seek(position_ms).await
}

#[tauri::command]
async fn spotify_set_volume(state: State<'_, AppState>, volume_percent: u8) -> Result<(), String> {
    if state.mock { mock::set_volume(volume_percent); return Ok(()); }
    if volume_percent > 100 {
        return Err("volume_percent must be 0..=100".to_string());
    }
    let client = state.spotify.lock().await;
    client.set_volume(volume_percent).await
}

#[tauri::command]
async fn spotify_set_shuffle(state: State<'_, AppState>, shuffle: bool) -> Result<(), String> {
    if state.mock { mock::set_shuffle(shuffle); return Ok(()); }
    let client = state.spotify.lock().await;
    client.set_shuffle(shuffle).await
}

#[tauri::command]
async fn spotify_set_repeat(state: State<'_, AppState>, repeat_state: String) -> Result<(), String> {
    if state.mock { mock::set_repeat(&repeat_state); return Ok(()); }
    let client = state.spotify.lock().await;
    client.set_repeat(&repeat_state).await
}

#[tauri::command]
async fn spotify_get_queue(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::queue()); }
    let client = state.spotify.lock().await;
    client.get_queue().await
}

#[tauri::command]
async fn spotify_get_devices(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::devices()); }
    let client = state.spotify.lock().await;
    client.get_devices().await
}

#[tauri::command]
async fn spotify_transfer_playback(state: State<'_, AppState>, device_id: String) -> Result<(), String> {
    if state.mock { return Ok(()); }
    let client = state.spotify.lock().await;
    client.transfer_playback(&device_id).await
}

#[tauri::command]
async fn spotify_search(state: State<'_, AppState>, query: String) -> Result<Value, String> {
    if state.mock { return Ok(mock::search(&query)); }
    let client = state.spotify.lock().await;
    client.search(&query).await
}

#[tauri::command]
async fn spotify_user_playlists(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::playlists()); }
    let client = state.spotify.lock().await;
    client.get_user_playlists().await
}

#[tauri::command]
async fn spotify_playlist_tracks(state: State<'_, AppState>, playlist_id: String) -> Result<Value, String> {
    if state.mock { return Ok(mock::playlist_tracks(&playlist_id)); }
    let client = state.spotify.lock().await;
    client.get_playlist_tracks(&playlist_id).await
}

#[tauri::command]
async fn spotify_get_playlist(state: State<'_, AppState>, playlist_id: String) -> Result<Value, String> {
    if state.mock { return Ok(mock::playlist(&playlist_id)); }
    let client = state.spotify.lock().await;
    client.get_playlist(&playlist_id).await
}

#[tauri::command]
async fn spotify_saved_tracks(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::saved_tracks()); }
    let client = state.spotify.lock().await;
    client.get_saved_tracks().await
}

#[tauri::command]
async fn spotify_saved_albums(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::saved_albums()); }
    let client = state.spotify.lock().await;
    client.get_saved_albums().await
}

#[tauri::command]
async fn spotify_user_profile(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::user_profile()); }
    let client = state.spotify.lock().await;
    client.get_user_profile().await
}

#[tauri::command]
async fn spotify_featured_playlists(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::featured_playlists()); }
    let client = state.spotify.lock().await;
    client.get_featured_playlists().await
}

#[tauri::command]
async fn spotify_categories(state: State<'_, AppState>) -> Result<Value, String> {
    if state.mock { return Ok(mock::categories()); }
    let client = state.spotify.lock().await;
    client.get_categories().await
}

#[tauri::command]
async fn spotify_get_album(state: State<'_, AppState>, album_id: String) -> Result<Value, String> {
    if state.mock { return Ok(mock::album(&album_id)); }
    let client = state.spotify.lock().await;
    client.get_album(&album_id).await
}

#[tauri::command]
async fn spotify_get_artist(state: State<'_, AppState>, artist_id: String) -> Result<Value, String> {
    if state.mock { return Ok(mock::artist(&artist_id)); }
    let client = state.spotify.lock().await;
    client.get_artist(&artist_id).await
}

#[tauri::command]
async fn spotify_get_artist_top_tracks(state: State<'_, AppState>, artist_id: String) -> Result<Value, String> {
    if state.mock { return Ok(mock::artist_top_tracks(&artist_id)); }
    let client = state.spotify.lock().await;
    client.get_artist_top_tracks(&artist_id).await
}

#[tauri::command]
async fn spotify_play_context(state: State<'_, AppState>, context_uri: String, offset_uri: Option<String>) -> Result<(), String> {
    if state.mock { mock::play(); return Ok(()); }
    let client = state.spotify.lock().await;
    client.play_context(&context_uri, offset_uri.as_deref()).await
}

#[tauri::command]
async fn spotify_play_uris(state: State<'_, AppState>, uris: Vec<String>, offset: Option<u32>) -> Result<(), String> {
    if state.mock { mock::play(); return Ok(()); }
    let client = state.spotify.lock().await;
    client.play_uris(uris, offset).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mock = std::env::var("SPX_MOCK")
        .is_ok_and(|v| v == "1" || v == "true");

    let (client_id, redirect_uri) = if mock {
        ("mock_client_id".to_string(), "http://localhost:1420/callback".to_string())
    } else {
        (
            std::env::var("SPOTIFY_CLIENT_ID")
                .expect("SPOTIFY_CLIENT_ID env var must be set"),
            std::env::var("SPOTIFY_REDIRECT_URI")
                .unwrap_or_else(|_| "com.spx.app://callback".to_string())
        )
    };

    let state = AppState {
        mock,
        spotify: tokio::sync::Mutex::new(SpotifyClient::new(client_id, redirect_uri)),
        refresh_token: tokio::sync::Mutex::new(None),
    };

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            is_mock_mode,
            spotify_auth_url,
            spotify_handle_callback,
            spotify_refresh_token,
            spotify_playback,
            spotify_play,
            spotify_pause,
            spotify_next,
            spotify_previous,
            spotify_seek,
            spotify_set_volume,
            spotify_set_shuffle,
            spotify_set_repeat,
            spotify_get_queue,
            spotify_get_devices,
            spotify_transfer_playback,
            spotify_search,
            spotify_user_playlists,
            spotify_playlist_tracks,
            spotify_get_playlist,
            spotify_saved_tracks,
            spotify_saved_albums,
            spotify_user_profile,
            spotify_featured_playlists,
            spotify_categories,
            spotify_get_album,
            spotify_get_artist,
            spotify_get_artist_top_tracks,
            spotify_play_context,
            spotify_play_uris,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    // Register deep link handler for desktop
    #[cfg(desktop)]
    {
        let app_handle = builder.handle().clone();
        builder.handle().deep_link().on_open_url(move |event| {
            if let Some(url) = event.urls().first() {
                if let Some((code, state)) = parse_deep_link(url.as_str()) {
                    let _ = app_handle.emit("deep-link-callback", serde_json::json!({
                        "code": code,
                        "state": state
                    }));
                }
            }
        });
    }

    builder.run(|app_handle, event| {
        if let tauri::RunEvent::Reopen { .. } = event {
            for window in app_handle.webview_windows().values() {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}
