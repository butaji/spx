# macOS 26 (Tahoe) Compatibility

## Problem
Tauri 2.11.2 / tao 0.35.3 is affected by a macOS 26 runtime issue tracked at:
- https://github.com/tauri-apps/tauri/issues/15517
- https://github.com/tauri-apps/tao/issues/1171

On macOS 26, Objective-C method return-type encodings changed from signed (`q` /
`Int64`) to unsigned (`Q` / `UInt64`). The `objc2` crate validates these
encodings strictly and panics inside the `applicationDidFinishLaunching:`
delegate callback. Because that callback is an `extern "C"` Objective-C
method, the panic cannot unwind and the process aborts with `SIGABRT`.

## Fixes applied in this project

### 1. Enable `objc2` `relax-sign-encoding`
`src-tauri/Cargo.toml` now requests the `relax-sign-encoding` feature for
`objc2`:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc = "0.2"
# Workaround for macOS 26 (Tahoe): Objective-C method return-type encodings
# changed from signed to unsigned integers, which objc2 validates strictly.
# Enable relax-sign-encoding so tao's app delegate callbacks do not panic.
objc2 = { version = "0.6", features = ["relax-sign-encoding"] }
```

This matches the upstream fix used by `winit` 0.30.12 and prevents the
signature-mismatch panic in tao's `did_finish_launching`.

### 2. Ensure the process is a foreground application
`src-tauri/src/lib.rs` calls `TransformProcessType` to
`kProcessTransformToForegroundApplication` before Tauri sets up the event loop.
This makes terminal-launched binaries behave like normal apps and ensures
`NSApplication` delivers lifecycle events.

### 3. Run the WebSocket backend inside the GUI process
`src-tauri/src/lib.rs` starts `ws_server::run_server()` in a Tauri async task
inside the `setup` callback. This means you only need to launch `spx`; you no
longer need to start `ws-server` as a separate process before the GUI. The
standalone `ws-server` binary is still built for backend-only / headless use.

### 4. Disable librespot local audio (SPX Connect) on macOS 26
macOS 26 (Tahoe) has a known CoreAudio memory-corruption bug that causes a
`SIGSEGV` inside `HALC_ProxyIOContext::GetPropertyData` when CPAL/Rodio
initialise the default output device. Apple has acknowledged the issue but has
not yet shipped a fix.

`src-tauri/src/librespot_player.rs` detects macOS 26+ and refuses to create the
librespot audio sink, returning a clear error instead of crashing. The frontend
falls back to the SPX Player (Web Playback SDK) so playback on this Mac still
works.

To force-enable SPX Connect anyway (for testing), launch SPX with:

```bash
SPX_FORCE_LIBRESPOT=1 /Applications/SPX.app/Contents/MacOS/spx
```

## Running the app

### From a normal macOS GUI session
Use the launcher script:

```bash
/Users/admin/Code/GitHub/spx/launch_spx.sh
```

Or launch the bundled binary directly after ad-hoc signing:

```bash
codesign --force --deep --sign - /Users/admin/Desktop/SPX.app
/Users/admin/Desktop/SPX.app/Contents/MacOS/spx
```

### From a non-GUI shell
The app must be launched from a logged-in macOS Aqua/GUI session. Running it
from SSH, CI, or screen-sharing without console access will cause Tauri to hang
inside `-[NSApplication run]` because `applicationDidFinishLaunching:` is never
delivered. Run the launcher from **Terminal.app** or **iTerm2.app** in a
logged-in session.

## Build

```bash
cd /Users/admin/Code/GitHub/spx
npm run tauri build
```

The bundled app is produced at:

```
src-tauri/target/release/bundle/macos/SPX.app
```

Copy it to `/Applications` or `~/Desktop` and run the launcher script.

## Status
- ✅ `SIGABRT` crash fixed (`relax-sign-encoding`)
- ✅ App builds successfully
- ✅ Single-binary launch (`spx` now starts the WS backend internally)
- ✅ GUI appears when launched from a real Aqua session
- ⚠️  SPX Connect local audio is disabled on macOS 26 to avoid a CoreAudio `SIGSEGV`
- ⚠️  Still requires a real macOS GUI session; headless shells are not supported

## Files changed
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/librespot_player.rs`
- `src/stores/devices.ts`
- `launch_spx.sh`
- `MACOS26_ISSUE.md`
