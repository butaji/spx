#!/bin/bash
# SPX Launcher - Launches the bundled SPX app.
#
# Starting with the macOS 26 (Tahoe) fixes, the WebSocket backend runs inside
# the SPX process, so only the main app binary needs to be launched.
#
# NOTE: This app must be run from a logged-in macOS Aqua/GUI session. Launching
# it from a non-GUI shell (SSH, CI, screen sharing without console access, etc.)
# will cause Tauri to hang inside -[NSApplication run] because
# applicationDidFinishLaunching: is never delivered without a proper GUI
# session. If this script appears to hang, move to Terminal.app / iTerm2.app in
# a logged-in session.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_BUNDLE="$SCRIPT_DIR/src-tauri/target/release/bundle/macos/SPX.app"
APP_BUNDLE="${1:-$DEFAULT_BUNDLE}"
APP_DIR="$APP_BUNDLE/Contents/MacOS"

if [ ! -d "$APP_BUNDLE" ]; then
    echo "ERROR: $APP_BUNDLE not found. Build the app first with 'npm run tauri build'."
    echo ""
    echo "Usage: $0 [path/to/SPX.app]"
    exit 1
fi

# Re-sign the app bundle ad-hoc. Tauri 2.11.2 links the executable with a
# linker-signed ad-hoc signature that references the build-time path; copying
# the bundle breaks that signature and the kernel kills the binary with SIGKILL
# (Killed: 9). A fresh ad-hoc signature fixes this.
codesign --remove-signature "$APP_BUNDLE" 2>/dev/null || true
codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null 2>&1 || true

# Kill any existing SPX process
pkill -f "SPX.app/Contents/MacOS/spx" 2>/dev/null || true
sleep 1

# Start the main app
"$APP_DIR/spx" &
APP_PID=$!
echo "SPX app started (PID: $APP_PID)"

# Wait for app to exit
wait "$APP_PID"
echo "SPX app exited"
