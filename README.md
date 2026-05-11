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

Spotify rejects `localhost` and `127.0.0.1` redirect URIs. Use **ngrok** for HTTPS tunneling:

1. **Install ngrok:**
   ```bash
   brew install ngrok
   ```

2. **Sign up** at [ngrok.com](https://ngrok.com) (free tier)

3. **Add your authtoken:**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

4. **Create a Spotify app** at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)

5. **Start ngrok tunnel** (separate terminal):
   ```bash
   ngrok http 1420
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

6. **Add redirect URI to Spotify app:**
   - In Spotify Dashboard → Edit Settings → Web API
   - Add: `https://abc123.ngrok-free.app/callback` (your ngrok URL + `/callback`)

7. **Create your `.env` file:**
   ```bash
   echo 'VITE_SPOTIFY_CLIENT_ID="your_client_id"' > .env
   ```

8. **Start the app:** `npm run tauri dev`

9. **Click "Connect Spotify"** — a browser tab opens

10. **Approve SPX access** in Spotify's authorization page

11. **Spotify redirects you** to your ngrok URL
    - The callback server built into SPX intercepts this automatically

12. **You're authenticated!** The ngrok URL must stay running while using SPX.

> **Note:** Keep `ngrok http 1420` running in a terminal while using SPX. Free tier ngrok URLs change on restart.

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
