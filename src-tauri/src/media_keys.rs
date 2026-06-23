//! Media key support via global shortcuts.
//!
//! Registers media key shortcuts (Play/Pause, Next, Previous) that emit
//! events to the frontend for handling.

use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
use tracing::{info, warn};

/// Media key event types sent to the frontend
#[derive(Clone, serde::Serialize)]
pub struct MediaKeyEvent {
    pub action: String,
}

/// Register all media key shortcuts.
pub fn register_media_keys(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    info!("Registering media key shortcuts...");

    let app_handle = app.clone();
    let global_shortcut = app.global_shortcut();

    // Build shortcuts using key codes
    // MediaPlayPause is typically the same as Play key
    let play_pause = Shortcut::new(None, Code::MediaPlayPause);
    let next_track = Shortcut::new(None, Code::MediaTrackNext);
    let prev_track = Shortcut::new(None, Code::MediaTrackPrevious);

    let app_for_pp = app_handle.clone();
    let app_for_next = app_handle.clone();
    let app_for_prev = app_handle.clone();

    // Register MediaPlayPause
    global_shortcut.on_shortcut(play_pause, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            info!("Media key: Play/Pause pressed");
            let _ = app_for_pp.emit(
                "media-key",
                MediaKeyEvent {
                    action: "play_pause".to_string(),
                },
            );
        }
    })?;

    // Register MediaNextTrack
    global_shortcut.on_shortcut(next_track, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            info!("Media key: Next Track pressed");
            let _ = app_for_next.emit(
                "media-key",
                MediaKeyEvent {
                    action: "next".to_string(),
                },
            );
        }
    })?;

    // Register MediaPrevTrack
    global_shortcut.on_shortcut(prev_track, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            info!("Media key: Previous Track pressed");
            let _ = app_for_prev.emit(
                "media-key",
                MediaKeyEvent {
                    action: "previous".to_string(),
                },
            );
        }
    })?;

    info!("Media key shortcuts registered successfully");
    Ok(())
}

/// Unregister all media key shortcuts (for cleanup).
pub fn unregister_media_keys(app: &AppHandle) {
    if let Err(e) = app.global_shortcut().unregister_all() {
        warn!("Error unregistering media keys: {}", e);
    }
}
