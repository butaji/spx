# SPX

### *The child of Spotify and Last.fm 2009* 💀

**SPX** is a retro-styled Spotify remote control for macOS, built with a web frontend and a native Rust backend.

![SPX Screenshot](assets/screenshot.jpeg)

---

## Why SPX?

| Problem | Solution |
|---------|----------|
| Spotify desktop is heavy | Lightweight Tauri shell + local WebSocket backend |
| No scrobble counts | Real play counts, listening history |
| Clunky UI | Dark liquid-glass, keyboard-first |
| Can't develop offline | Built-in **mock mode** |

---

## Features

- **Playback:** Full control, Spotify Connect, queue management
- **Library:** Search, browse, home recommendations
- **Stats:** Scrobble counts, listening history
- **UI:** Liquid-glass dark theme, native macOS titlebar, keyboard shortcuts
- **Dev:** Mock mode, hot reload, zero Spotify account needed
- **Local devices:** mDNS discovery and Google Cast wake-up

---

## Requirements

- macOS 14.0+ (Sonoma or later)
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.77+
- A Spotify Premium account (for remote playback control)
- A Spotify app/client ID for OAuth

---

## Quick Start

```bash
npm install
npm run tauri dev
```

### Mock mode (no Spotify account)

```bash
./dev.sh network:mock
# or
VITE_SPX_MOCK=1 npm run dev
```

### Production build

```bash
npm run tauri build
./launch_spx.sh
```

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Tauri 2 (Rust) |
| UI | Preact 10 + TypeScript |
| Build | Vite 5 |
| Backend | Rust + Tokio + WebSocket |
| Spotify API | librespot OAuth + rspotify Web API |
| Local devices | mDNS + Google Cast V2 |

---

## Project structure

```
.
├── src/                  # Preact frontend
│   ├── components/       # UI components
│   ├── screens/          # Page-level screens
│   ├── stores/           # Preact Signals state
│   ├── hooks/            # Shared hooks
│   ├── lib/              # API client, cache, hotkeys, etc.
│   └── tests/            # Deno-based integration helpers
├── src-tauri/            # Rust Tauri backend
│   ├── src/              # Rust source
│   ├── capabilities/     # Tauri permissions
│   ├── icons/            # App icons
│   └── Cargo.toml
├── dev.sh                # Development script
├── launch_spx.sh         # Launch bundled app
└── package.json
```

---

## Spotify OAuth setup

SPX uses **librespot OAuth** (the same proven flow as `spotify-player`) to authenticate and cache credentials locally. On first launch it opens the browser; after that, sessions are restored from the local cache.

1. Create an app at https://developer.spotify.com/dashboard
2. Add `http://127.0.0.1:1422/callback` to the app's Redirect URIs
3. Set your client ID before running:

```bash
export SPOTIFY_CLIENT_ID=your_client_id
npm run tauri dev
```

The client ID can also be supplied via:
- `SPOTIFY_CLIENT_ID` / `VITE_SPOTIFY_CLIENT_ID` environment variables
- `src-tauri/spx_client_id.txt` bundled as a resource

---

## Hotkeys

| Key | Action |
|-----|--------|
| `Cmd + 1` | Now Playing |
| `Cmd + 2` | Search |
| `Cmd + 3` | Library |
| `Cmd + 4` | Queue |
| `Space` | Play / Pause |
| `Cmd + ←` | Previous track |
| `Cmd + →` | Next track |
| `Cmd + ↑` | Volume up |
| `Cmd + ↓` | Volume down |
| `S` | Toggle shuffle |
| `R` | Cycle repeat (off → context → track) |
| `M` | Mute / unmute |
| `/` | Focus search |
| `?` | Hotkey help |
| `Esc` | Close / go back |

Shortcuts are disabled while typing in inputs.

---

## Development scripts

| Command | Description |
|---------|-------------|
| `./dev.sh dev` | Run Tauri native app |
| `./dev.sh frontend` | Run Vite dev server only |
| `./dev.sh backend` | Run Rust WebSocket backend only |
| `./dev.sh network:mock` | Browser mode with mock data |
| `./dev.sh network:real` | Browser mode with real Spotify API |
| `./dev.sh build` | Build production .app bundle |
| `npm test` | Run Vitest unit tests |
| `npm run test:typecheck` | Type-check test files |
| `./launch_spx.sh [path/to/SPX.app]` | Launch built app |

---

## Testing

```bash
npm test              # unit tests
npm run test:typecheck
```

End-to-end smoke tests use Playwright and expect a running dev server:

```bash
# Terminal 1: start mock dev server
./dev.sh network:mock

# Terminal 2: run e2e smoke test
npm run test:e2e:mock
```

The `src/tests/` directory contains Deno-based helper scripts for recording Spotify API fixtures; they are not run by Vitest.

---

## macOS permissions

The app requests the following entitlements:

- Outbound network connections (Spotify API)
- Inbound network connections (OAuth callback server)
- Bonjour/mDNS and local network multicast (Cast device discovery)
- File access for cached token storage

For Cast discovery in a sandboxed App Store build, you may need the `com.apple.developer.networking.multicast` entitlement and a provisioning profile.

---

## Contributing

Mock mode works without Spotify credentials. Good first issues welcome.

---

MIT

**Made for music obsessives. Scrobble on.** 💀
