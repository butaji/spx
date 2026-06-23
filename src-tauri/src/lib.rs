#![allow(unexpected_cfgs)]

pub mod actors;
pub mod cast_raw_auth;
pub mod commands;
pub mod cookie_capture;
pub mod events;
pub mod fn_utils;
pub mod librespot_player;
pub mod mdns;
pub mod media_keys;
mod menu;
pub mod now_playing;
pub mod oauth_callback;
pub mod spotify_cast;
pub mod web_player_token;

#[cfg(target_os = "macos")]
pub mod macos_permission;

use tauri::Manager;
use tracing::debug;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // macOS 26 (Tahoe) workaround: when the binary is launched directly from a
    // terminal the process may not be treated as a foreground application, which
    // prevents NSApplication from delivering applicationDidFinishLaunching:.
    // Transform the process to a foreground application before Tauri sets up
    // the event loop.
    #[cfg(target_os = "macos")]
    unsafe {
        use std::os::raw::c_int;
        #[repr(C)]
        struct ProcessSerialNumber {
            high_long: u32,
            low_long: u32,
        }
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn TransformProcessType(
                psn: *const ProcessSerialNumber,
                transform_state: c_int,
            ) -> c_int;
        }
        const K_CURRENT_PROCESS: u32 = 2;
        const K_PROCESS_TRANSFORM_TO_FOREGROUND_APPLICATION: c_int = 1;
        let psn = ProcessSerialNumber {
            high_long: 0,
            low_long: K_CURRENT_PROCESS,
        };
        TransformProcessType(&psn, K_PROCESS_TRANSFORM_TO_FOREGROUND_APPLICATION);
    }

    // Initialize tracing subscriber so backend logs are captured
    let _ = tracing_subscriber::fmt::try_init();

    // Global panic handler to count panics for diagnostics
    std::panic::set_hook(Box::new(|_| {
        commands::increment_panic_count();
    }));

    // Try to install aws_lc_rs crypto provider, but don't panic if it fails
    if let Err(e) = std::panic::catch_unwind(|| {
        use rustls::crypto::aws_lc_rs;
        let _ = aws_lc_rs::default_provider().install_default();
    }) {
        tracing::warn!("Could not install AWS-LC crypto provider: {:?}", e);
    }

    dotenvy::dotenv().ok();

    // When the app runs from a bundle (Desktop), dotenvy::dotenv() looks in the
    // working directory (/), which won't have .env. Load it from the bundle's
    // Resources directory explicitly.
    if std::env::var("SPOTIFY_CLIENT_ID").is_err() {
        if let Ok(exe_path) = std::env::current_exe() {
            // macOS bundle: Contents/MacOS/spx → Contents/Resources/.env
            let resources_env = exe_path
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("Resources/.env"))
                .unwrap_or_default();
            if resources_env.exists() {
                debug!("Loading .env from bundle: {:?}", resources_env);
                let _ = dotenvy::from_filename(&resources_env).ok();
            }
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Start OAuth callback server on port 1422
            oauth_callback::start_oauth_callback_server(app.handle().clone());

            // Build the macOS menu bar.
            #[cfg(target_os = "macos")]
            {
                let _ = menu::build_menu(app.app_handle());
            }

            // Register media key shortcuts (play/pause, next, previous)
            if let Err(e) = media_keys::register_media_keys(app.app_handle()) {
                tracing::warn!("Failed to register media key shortcuts: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_spotify_client_id,
            commands::check_credentials_status,
            commands::authenticate_librespot_oauth,
            commands::create_librespot_session,
            commands::start_local_connect_device,
            commands::scan_spotify_devices,
            commands::wake_cast_device,
            commands::authenticate_cast_device_command,
            commands::authenticate_cast_device_raw_command,
            commands::get_web_player_token_command,
            commands::start_spotify_cookie_capture,
            commands::clear_spotify_sp_dc,
            commands::get_stored_sp_dc,
            commands::get_callback_server_status,
            commands::get_diagnostics,
            commands::diagnose_network,
            commands::request_macos_local_network_permission,
            commands::get_event_history,
            commands::emit_spx_event,
            now_playing::update_now_playing,
            now_playing::clear_now_playing,
            commands::ping,
        ])
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
