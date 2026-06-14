#![allow(unexpected_cfgs)]

pub mod actors;
pub mod commands;
pub mod mdns;
pub mod spotify;
pub mod spotify_cast;
pub mod cast_raw_auth;
pub mod spotify_backend;
pub mod ws_server;
pub mod media_keys;
pub mod now_playing;
mod menu;

#[cfg(target_os = "macos")]
pub mod macos_permission;

use tauri::Manager;

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
            fn TransformProcessType(psn: *const ProcessSerialNumber, transform_state: c_int) -> c_int;
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

    // Try to install aws_lc_rs crypto provider, but don't panic if it fails
    if let Err(e) = std::panic::catch_unwind(|| {
        use rustls::crypto::aws_lc_rs;
        let _ = aws_lc_rs::default_provider().install_default();
    }) {
        tracing::warn!("Could not install AWS-LC crypto provider: {:?}", e);
    }

    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Build the macOS menu bar.
            #[cfg(target_os = "macos")]
            {
                let _ = menu::build_menu(app.app_handle());
            }
            
            // Register media key shortcuts (play/pause, next, previous)
            if let Err(e) = media_keys::register_media_keys(app.app_handle()) {
                tracing::warn!("Failed to register media key shortcuts: {}", e);
            }

            // Start the WebSocket backend inside the GUI process. This avoids
            // macOS 26 issues where launching a secondary binary from inside an
            // .app bundle hangs at dyld_start in headless/non-GUI contexts, and
            // it lets users launch SPX with a single binary.
            let ws_port = 1424;
            let addr = std::net::SocketAddr::from(([127, 0, 0, 1], ws_port));

            // Try to bind the port ourselves first to avoid racing with another process.
            match std::net::TcpListener::bind(addr) {
                Ok(listener) => {
                    // We own the port; release it so the async server can bind.
                    drop(listener);
                    eprintln!("[SPX] Starting in-process ws-server on port {}", ws_port);
                    tracing::info!("Starting in-process ws-server on port {}", ws_port);
                    tauri::async_runtime::spawn(async move {
                        let result = ws_server::run_server().await;
                        match result {
                            Ok(_) => tracing::info!("WS server exited normally"),
                            Err(e) => {
                                eprintln!("[SPX] WS server error: {}", e);
                                tracing::error!("WS server error: {}", e);
                            }
                        }
                    });
                }
                Err(bind_err) => {
                    // Port is taken. Determine whether it is already a SPX backend or something else.
                    match std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(500)) {
                        Ok(_) => {
                            tracing::warn!(
                                "Port {} is already in use (bind failed: {}). SPX will attempt to use the existing listener, but it may be a stale or foreign service.",
                                ws_port, bind_err
                            );
                        }
                        Err(conn_err) => {
                            tracing::error!(
                                "Port {} cannot be bound ({}) and no existing listener is reachable ({}). The WebSocket backend will not be available.",
                                ws_port, bind_err, conn_err
                            );
                        }
                    }
                }
            }
            Ok(())
        })
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
            commands::authenticate_librespot,
            commands::restore_librespot_session,
            commands::clear_librespot_session,
            now_playing::update_now_playing,
            now_playing::clear_now_playing,
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
