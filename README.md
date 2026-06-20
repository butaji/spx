# SPX

**The child of Spotify and Last.fm 2009** 💀

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
- **Stats:** Play counts, listening history
- **UI:** Liquid-glass dark theme, native macOS titlebar, keyboard shortcuts
- **Dev:** Mock mode, hot reload, zero Spotify account needed
- **Local devices:** mDNS discovery and Google Cast wake-up
- **macOS Integration:** Global media keys, Now Playing on lock screen
- **Error Handling:** Comprehensive error messages with solutions

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
cp .env.example .env
# Edit .env with SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET

npm run tauri dev
```

### Mock Mode (no Spotify account)

```bash
VITE_SPX_MOCK=1 npm run dev
```

### Production Build

```bash
npm run tauri build
```

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Tauri 2 (Rust) |
| UI | Preact 10 + TypeScript |
| Build | Vite 5 |
| Backend | Rust + Tokio + WebSocket |
| Spotify API | PKCE OAuth + @spotify/web-api-ts-sdk |
| Local devices | mDNS + Google Cast |
| Testing | Vitest + Playwright |

---

## Project Structure

```
src/                  # Preact frontend
│   ├── components/   # UI components
│   ├── screens/     # Page-level screens
│   ├── stores/      # Preact Signals state
│   ├── hooks/       # Shared hooks
│   ├── lib/         # API client, cache, errors
│   └── styles/      # CSS styles
src-tauri/            # Rust Tauri backend
│   ├── src/         # Rust source
│   └── capabilities/ # Tauri permissions
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Run the full app |
| `npm run dev` | Vite frontend only |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run tauri build` | Production build |

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
| `R` | Cycle repeat |
| `M` | Mute / unmute |
| `/` | Focus search |
| `Esc` | Close / go back |

Shortcuts are disabled while typing in inputs.

---

## macOS Permissions

The app requests: outbound/inbound network (Spotify API + OAuth callback), Bonjour/mDNS (Cast discovery), global media keys, Now Playing info center.

---

**Made for music obsessives. Scrobble on.** 💀
