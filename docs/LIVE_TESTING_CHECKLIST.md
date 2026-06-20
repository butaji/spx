# SPX Live Testing Checklist

Run these against the real Spotify API + the built `SPX.app` (or the Vite dev server).

## Prerequisites

- Spotify account with Premium (required for playback control).
- Valid access token in `/tmp/spx_token.json` or `SPX_LIVE_TOKEN` env var.
- Desktop `.app` on `~/Desktop/SPX.app` or web UI running.
- Browser backend running if testing web mode: `node callback-server.mjs`.

## Automated runner

```bash
# Using env token
SPX_LIVE_TOKEN=your_token node live-test.mjs

# Using token file
echo '{"access_token":"your_token"}' > /tmp/spx_token.json
node live-test.mjs

# Visible browser
SPX_HEADLESS=0 SPX_LIVE_TOKEN=your_token node live-test.mjs
```

## 1. Authentication & startup

| # | Test | Expected |
|---|------|----------|
| 1.1 | Launch app / open web UI | App shows Home screen, not auth screen, within 5 s |
| 1.2 | Check Diagnostics → Auth | Status: authenticated, token valid, scopes listed |
| 1.3 | Refresh token expiry | Token shows > 0 s remaining |
| 1.4 | Kill and relaunch | Session restores without re-login |

## 2. Now Playing / PlayerBar sync

| # | Test | Expected |
|---|------|----------|
| 2.1 | With nothing playing | Now Playing shows last-played track name + artist |
| 2.2 | With nothing playing | PlayerBar shows the **same** track name/artist as Now Playing |
| 2.3 | Start playback on another device | Both Now Playing and PlayerBar update to the currently playing track |
| 2.4 | Pause playback | Play button appears; track info stays visible |
| 2.5 | Progress bar | Advances while playing; seek works |
| 2.6 | Like button | Toggles like state; reflected in PlayerBar and Now Playing |

## 3. Playback controls

| # | Test | Expected |
|---|------|----------|
| 3.1 | Play / pause | Resumes/pauses playback on active device |
| 3.2 | Next / previous | Skips tracks |
| 3.3 | Shuffle toggle | Shuffle state flips; reflected in UI |
| 3.4 | Repeat toggle | Cycles off → context → track |
| 3.5 | Volume | Slider adjusts volume; mute restores to ~74 % |
| 3.6 | Seek | Clicking progress bar jumps position |

## 4. Device selector & transfer

| # | Test | Expected |
|---|------|----------|
| 4.1 | Open app, wait 2 s, open device menu | At minimum "SPX Player" appears without manual scan |
| 4.2 | On same network as Cast/Connect speakers | Spotify Connect devices and local Cast devices appear |
| 4.3 | Select a Spotify Connect speaker | Playback transfers; active device indicator updates |
| 4.4 | Select a Cast device | If `sp_dc` is configured, transfer succeeds; otherwise shows helpful message |
| 4.5 | Select "SPX Player" / "SPX Connect" | Playback routes to local Mac |
| 4.6 | Device disappears | UI falls back gracefully, no crash |

## 5. Library & content screens

| # | Test | Expected |
|---|------|----------|
| 5.1 | Open Library | User playlists / saved albums load |
| 5.2 | Click a playlist | Playlist detail opens; track count > 0; tracks render |
| 5.3 | Click a track in playlist | Track starts playing on active device |
| 5.4 | Click album | Album tracks load |
| 5.5 | Click artist | Artist top tracks + albums load |
| 5.6 | Search | Search returns tracks, artists, albums, playlists |

## 6. Queue

| # | Test | Expected |
|---|------|----------|
| 6.1 | Open Queue screen | Currently playing + queued tracks shown |
| 6.2 | Add to queue from context menu | Track appears in queue |

## 7. Diagnostics

| # | Test | Expected |
|---|------|----------|
| 7.1 | Open Diagnostics tab | All cards render: Auth, Playback, Devices, Backend, System |
| 7.2 | Click "Run Diagnostics" | All checks update; no false DOWN states |
| 7.3 | Click "Copy Report" | JSON report copied to clipboard |
| 7.4 | Click "Copy Full Report" | Extended report copied |
| 7.5 | JS logs / Rust logs | Recent logs visible |

## 8. Network / backend

| # | Test | Expected |
|---|------|----------|
| 8.1 | `curl http://127.0.0.1:1422/health` | Returns `{ status: "ok" }` |
| 8.2 | `curl http://127.0.0.1:1422/local-devices` | Returns discovered local devices |
| 8.3 | Web UI can reach Spotify API | No CORS errors in console |

## 9. Error handling

| # | Test | Expected |
|---|------|----------|
| 9.1 | Revoke token and refresh | App shows re-authenticate message |
| 9.2 | Block internet | Offline diagnostics show meaningful error |
| 9.3 | No active device | Play attempt shows "No Active Device" guidance |

## 10. Desktop app specific

| # | Test | Expected |
|---|------|----------|
| 10.1 | Launch `~/Desktop/SPX.app` | App opens, not blocked by Gatekeeper |
| 10.2 | Local Network permission prompt | Allow; devices appear |
| 10.3 | Media keys | Play/pause/next/prev keyboard shortcuts work |
| 10.4 | App menu | Diagnostics tab accessible from sidebar |
| 10.5 | Quit and reopen | Session persists |

## Regression commands

```bash
# Frontend unit tests
npm test

# Rust unit tests
cargo test

# Frontend build
npm run build

# Full Tauri build
npm run tauri build

# E2E listing
npx playwright test src/tests/e2e-authenticated.spec.ts --list

# Run live automated checks (needs token)
SPX_LIVE_TOKEN=your_token node live-test.mjs
```

## Latest live run

Date: 2026-06-19
Command: `node live-test.mjs` (using `/tmp/spx_token.json`)
Result: **18/18 passed**

Verified:
- Real Spotify API auth + profile
- Playback state, queue, recently played
- Device list from Spotify API + local network Cast devices
- Now Playing / PlayerBar sync for currently playing track
- Library and playlist detail with tracks
- Diagnostics tab opens and renders all cards
- No unexpected console errors

## Sign-off criteria

- [x] All automated unit tests pass (`npm test`: 372 tests; `cargo test`: 53 passed, 11 ignored).
- [x] `npm run build` and `npm run tauri build` succeed.
- [x] `live-test.mjs` passes all API + UI checks (18/18).
- [ ] Manual checklist items 1–10 completed without critical failures.
- [x] No unhandled console errors during automated live testing.

## Release artifact

- Built `.app`: `~/Desktop/SPX.app`
- Source bundle: `/Users/admin/Code/GitHub/spx/src-tauri/target/release/bundle/macos/SPX.app`
- Diagnostics tab is always visible in the sidebar for troubleshooting.
