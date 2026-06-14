#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-dev}"
WS_BIN="$ROOT/src-tauri/target/debug/ws-server"

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "${WS_PID:-}" ]; then
    kill "$WS_PID" 2>/dev/null || true
  fi
  exit 0
}

ensure_ws_server() {
  local src_mtime
  src_mtime=$(find "$ROOT/src-tauri/src" -name '*.rs' -printf '%T@\n' 2>/dev/null | sort -n | tail -1 || echo 0)
  local bin_mtime=0
  if [ -f "$WS_BIN" ]; then
    bin_mtime=$(stat -f '%m' "$WS_BIN" 2>/dev/null || stat -c '%Y' "$WS_BIN" 2>/dev/null || echo 0)
  fi

  if [ -f "$WS_BIN" ] && [ "$bin_mtime" != "0" ] && [ "$bin_mtime" -gt "${src_mtime%.*}" ]; then
    echo "ws-server binary is up to date, skipping build"
    return 0
  fi

  echo "Building ws-server (this may take a while)..."
  cd "$ROOT/src-tauri"
  cargo build --bin ws-server
}

# macOS Tauri store path for the cached Spotify token
TAURI_STORE="$HOME/Library/Application Support/com.spx.app/spotify-auth.bin"

case "$MODE" in
    dev)
        cd "$ROOT" && npm run tauri dev
        ;;
    build)
        cd "$ROOT" && npm run tauri build
        ;;
    backend)
        echo "=== SPX Backend (WS server on 127.0.0.1:1424) ==="
        cd "$ROOT/src-tauri" && cargo run --bin ws-server
        ;;

    # ── Browser testing — mock data ──
    network|network:mock)
        echo "=== SPX Network — MOCK DATA ==="
        echo "  http://127.0.0.1:1422"
        echo ""
        ensure_ws_server
        cd "$ROOT/src-tauri"
        ./target/debug/ws-server &
        WS_PID=$!; trap cleanup INT TERM
        cd "$ROOT"
        echo "Starting frontend..."
        VITE_DEV_PORT=1422 VITE_SPX_MOCK=1 VITE_WS_URL="ws://127.0.0.1:1424" npm run dev -- --host 127.0.0.1 --port 1422
        ;;

    # ── Browser testing — real Spotify API ──
    network:real)
        echo "=== SPX Network — REAL SPOTIFY API ==="
        echo "  http://127.0.0.1:1422"
        echo ""

        # Check for SPOTIFY_CLIENT_ID
        if [ -z "${SPOTIFY_CLIENT_ID:-}" ]; then
            echo "ERROR: SPOTIFY_CLIENT_ID is required."
            echo ""
            echo "  1. Get a client ID at https://developer.spotify.com/dashboard"
            echo "  2. Add http://127.0.0.1:1422/callback to the app's Redirect URIs"
            echo "  3. Run: SPOTIFY_CLIENT_ID=your_id ./dev.sh network:real"
            exit 1
        fi

        # Try to extract the access token from env var or Tauri store
        TOKEN="${VITE_SPOTIFY_ACCESS_TOKEN:-}"
        if [ -n "$TOKEN" ]; then
            echo "Using token from VITE_SPOTIFY_ACCESS_TOKEN env var"
        elif [ -f "$TAURI_STORE" ]; then
            TOKEN=$(strings "$TAURI_STORE" 2>/dev/null | grep -A1 '"access_token"' | tail -1 | tr -d '"' || true)
            if [ -n "$TOKEN" ]; then
                echo "Using cached token from Tauri store"
            fi
        fi

        if [ -z "$TOKEN" ]; then
            echo ""
            echo "No token found. Provide one via env:"
            echo "  VITE_SPOTIFY_ACCESS_TOKEN=<token> ./dev.sh network:real"
            echo ""
            echo "Or run ./dev.sh dev first to cache a token via Tauri OAuth"
            echo ""
            echo "Get a temporary token at: https://developer.spotify.com/console/get-current-user-playlists/"
            exit 1
        fi

        ensure_ws_server
        cd "$ROOT/src-tauri"
        ./target/debug/ws-server &
        WS_PID=$!; trap cleanup INT TERM

        cd "$ROOT"
        echo "Starting frontend..."
        VITE_DEV_PORT=1422 \
        SPOTIFY_CLIENT_ID="$SPOTIFY_CLIENT_ID" \
        VITE_SPOTIFY_CLIENT_ID="$SPOTIFY_CLIENT_ID" \
        VITE_SPOTIFY_ACCESS_TOKEN="$TOKEN" \
        VITE_WS_URL="ws://127.0.0.1:1424" \
        npm run dev -- --host 127.0.0.1 --port 1422
        ;;

    frontend)
        cd "$ROOT" && npm run dev
        ;;
    help|--help|-h)
        echo "Usage: ./dev.sh <mode>"
        echo ""
        echo "  dev           Tauri native macOS app"
        echo "  build         Build .app bundle"
        echo "  backend       Rust WS server on 127.0.0.1:1424"
        echo "  network       Browser testing (mock data)"
        echo "  network:real  Browser testing (real Spotify API)"
        echo "  frontend      Vite dev server only"
        ;;
esac
