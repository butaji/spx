use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

pub fn build_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let app_menu = Submenu::with_items(
        app,
        "SPX",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About SPX"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "preferences", "Preferences...", true, Some("Cmd+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quit SPX"))?,
        ]
    )?;

    let playback_menu = Submenu::with_items(
        app,
        "Playback",
        true,
        &[
            &MenuItem::with_id(app, "play_pause", "Play/Pause", true, Some("Space"))?,
            &MenuItem::with_id(app, "next_track", "Next Track", true, Some("Cmd+Right"))?,
            &MenuItem::with_id(app, "prev_track", "Previous Track", true, Some("Cmd+Left"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "vol_up", "Volume Up", true, Some("Cmd+Up"))?,
            &MenuItem::with_id(app, "vol_down", "Volume Down", true, Some("Cmd+Down"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "shuffle", "Shuffle", true, Some("Cmd+S"))?,
            &MenuItem::with_id(app, "repeat", "Repeat", true, Some("Cmd+R"))?,
        ]
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(app, "now_playing", "Now Playing", true, Some("Cmd+1"))?,
            &MenuItem::with_id(app, "search", "Search", true, Some("Cmd+2"))?,
            &MenuItem::with_id(app, "library", "Library", true, Some("Cmd+3"))?,
            &MenuItem::with_id(app, "queue", "Queue", true, Some("Cmd+4"))?,
        ]
    )?;

    let menu = Menu::with_items(app, &[
        &app_menu,
        &playback_menu,
        &view_menu,
    ])?;

    app.set_menu(menu.clone())?;

    app.on_menu_event(|app, event| {
        match event.id().as_ref() {
            "preferences" => { let _ = app.emit("menu:preferences", ()); }
            "play_pause" => { let _ = app.emit("menu:play_pause", ()); }
            "next_track" => { let _ = app.emit("menu:next_track", ()); }
            "prev_track" => { let _ = app.emit("menu:prev_track", ()); }
            "vol_up" => { let _ = app.emit("menu:vol_up", ()); }
            "vol_down" => { let _ = app.emit("menu:vol_down", ()); }
            "shuffle" => { let _ = app.emit("menu:shuffle", ()); }
            "repeat" => { let _ = app.emit("menu:repeat", ()); }
            "now_playing" => { let _ = app.emit("menu:now_playing", ()); }
            "search" => { let _ = app.emit("menu:search", ()); }
            "library" => { let _ = app.emit("menu:library", ()); }
            "queue" => { let _ = app.emit("menu:queue", ()); }
            _ => {}
        }
    });

    Ok(menu)
}
