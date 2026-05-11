# SPX

### *The child of Spotify and Last.fm 2009* 💀

You're at your desk. It's 2009. Last.fm's desktop scrobbler is running in the background, dutifully logging every track. You know exactly how many times you've played "Archangel" by Burial (it's 478, and you remember the exact day you hit 400).

**SPX** is what happens when you take that soul and build it with **Tauri + Rust** — not Electron. Native performance, real scrobbling, obsessive listening stats. Light on RAM. Heavy on nostalgia.

---

## Why SPX?

| Problem | Solution |
|---------|----------|
| Spotify desktop uses 300MB+ RAM | **Rust + native WebView** = ~50MB |
| No scrobble counts | Real play counts, listening history |
| Clunky UI | Dark liquid-glass, keyboard-first |
| Can't develop offline | Built-in **mock mode** |

---

## Features

**Playback:** Full control, Spotify Connect, queue management
**Library:** Search, browse, home recommendations  
**Stats:** Scrobble counts, listening history, retro data viz
**UI:** Liquid-glass dark theme, native macOS titlebar, keyboard shortcuts
**Dev:** Mock mode, hot reload, zero Spotify account needed

---

## Quick Start

```bash
npm install
SPX_MOCK=1 npm run tauri dev    # No Spotify account needed
```

**Real Spotify:**
1. [Create app](https://developer.spotify.com/dashboard) → Web API → `http://localhost:1420/callback`
2. `echo 'SPOTIFY_CLIENT_ID="your_id"\nSPOTIFY_REDIRECT_URI="http://localhost:1420/callback"' > .env`
3. `npm run tauri dev`
4. After clicking "Connect Spotify" and approving in browser, paste the redirect URL back into the app

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Tauri v2 (Rust) |
| Frontend | Preact + TypeScript |
| API | Spotify Web API + PKCE auth |

---

## Architecture

```
SPX/
├── src/            # Preact frontend (screens, hooks, types)
├── src-tauri/      # Rust backend (API, auth, mock stubs)
└── package.json
```

Rust handles all API calls. PKCE auth, auto-refreshing tokens. TypeScript everywhere.

---

## Hotkeys

| Key | Action |
|-----|--------|
| `Cmd + 1` | Now Playing |
| `Cmd + 2` | Search |
| `Cmd + 3` | Library |
| `Cmd + 4` | Queue |
| `Space` | Play / Pause |
| `←` | Previous track |
| `→` | Next track |
| `↑` | Volume up |
| `↓` | Volume down |
| `S` | Toggle shuffle |
| `R` | Cycle repeat (off → context → track) |
| `M` | Mute / unmute |
| `Alt + ←` | Go back |
| `Esc` | Close window (auth screen) |

Shortcuts are disabled while typing in inputs.

---

## Contributing

Mock mode works without Spotify credentials. Good first issues welcome.

---

MIT

**Made for music obsessives. Scrobble on.** 💀
