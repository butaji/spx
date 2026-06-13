pub mod commands;
pub mod mdns;
pub mod spotify_cast;
pub mod cast_raw_auth;
pub mod librespot_client;
mod menu;

#[cfg(target_os = "macos")]
pub mod macos_permission;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing subscriber so backend logs are captured
    tracing_subscriber::fmt::init();

    // Install aws_lc_rs crypto provider at startup, before any network operations
    use rustls::crypto::aws_lc_rs;
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_spotify_client_id,
            commands::start_callback_server,
            commands::is_mock_mode,
            commands::scan_spotify_devices,
            commands::wake_cast_device,
            commands::authenticate_cast_device_command,
            commands::authenticate_cast_device_raw_command,
            commands::diagnose_network,
            commands::request_macos_local_network_permission,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                menu::build_menu(app.app_handle())?;
            }
            Ok(())
        })
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
