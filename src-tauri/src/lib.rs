pub mod commands;
pub mod mdns;
pub mod spotify_cast;
pub mod cast_raw_auth;
pub mod spotify_backend;
pub mod ws_server;
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
        .setup(|app| {
            // Build the macOS menu bar.
            #[cfg(target_os = "macos")]
            {
                let _ = menu::build_menu(app.app_handle());
            }

            // Start the WebSocket backend inside the GUI process. This avoids
            // macOS 26 issues where launching a secondary binary from inside an
            // .app bundle hangs at dyld_start in headless/non-GUI contexts, and
            // it lets users launch SPX with a single binary.
            let already_running = std::net::TcpStream::connect_timeout(
                &std::net::SocketAddr::from(([127, 0, 0, 1], 1424)),
                std::time::Duration::from_millis(200),
            )
            .is_ok();

            if !already_running {
                tracing::info!("Starting in-process ws-server on port 1424");
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = ws_server::run_server().await {
                        tracing::error!("WS server error: {}", e);
                    }
                });
            } else {
                tracing::info!("ws-server already appears to be running on port 1424");
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
