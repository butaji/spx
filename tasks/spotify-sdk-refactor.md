# Task: Replace Rust Spotify Backend with Official Web SDK

## Why

Current problem:
- Rust backend (librespot) adds complexity, build time, and dependency issues
- librespot requires OAuth flow that opens browser → confuses users
- Official Spotify Web SDK is simpler, faster, and well-maintained
- PKCE auth happens entirely in browser, no backend needed

## Goal Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Preact Frontend                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Spotify Web SDK (spotify-web-api-js)    │   │
│  │         - PKCE OAuth in browser                 │   │
│  │         - All API calls direct to Spotify      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Rust Backend (Tauri)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  - Securely store CLIENT_ID, CLIENT_SECRET      │   │
│  │  - mDNS device discovery (Cast/Spotify Connect) │   │
│  │  - Now Playing notification                      │   │
│  │  - System tray integration                      │   │
│  │  - App lifecycle                                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Steps

### Phase 1: Audit Current State ✅

- [x] Document all current Spotify API calls from frontend
- [x] Document all Rust commands for Spotify auth/playback
- [x] Identify what's used vs what's dead code

### Phase 2: Add Spotify Web SDK to Frontend ✅

- [x] Install `spotify-web-api-js` package
- [x] Create `src/lib/spotify-sdk.ts` wrapper
- [x] Implement PKCE OAuth flow (no backend needed)
- [x] Move all API calls from Rust → SDK

### Phase 3: Simplify Rust Backend ✅

- [x] Remove `src-tauri/src/spotify/` directory (librespot code)
- [x] Remove `src-tauri/src/spotify_backend.rs`
- [x] Remove commands: `authenticate_librespot`, `restore_librespot_session`, `clear_librespot_session`
- [x] Keep: `check_credentials_status` (for clear error messages)
- [x] Keep: device discovery commands
- [x] Keep: now playing commands
- [x] Remove `ws_server.rs` and Spotify actor
- [x] Update Cargo.toml to remove rspotify, librespot dependencies

### Phase 4: Update Frontend Auth Flow ✅

- [x] Replace `startAuthFlow()` with SDK PKCE flow
- [x] Replace token storage with localStorage-based PKCE token storage
- [x] Update `restoreSession()` to use SDK
- [x] Remove dependencies on Rust auth commands
- [x] Update `useAuth.ts` with new auth flow

### Phase 5: Clean Up ✅

- [x] Remove unused imports
- [x] Update error messages to be SDK-friendly
- [ ] Test full auth flow (PENDING - requires running app)
- [ ] Update README with new setup instructions

## Current API Calls to Migrate

From `src/lib/spotify.ts`:
- `getPlaybackState()` → `getMyCurrentPlaybackState()`
- `play()` → `play()` / `playTrack()`
- `pause()` → `pause()`
- `next()` → `skipToNext()`
- `previous()` → `skipToPrevious()`
- `seek()` → `seek()`
- `setVolume()` → `setVolume()`
- `getAvailableDevices()` → `getMyDevices()`
- `transferPlayback()` → `transferMyPlayback()`
- `getQueue()` → `getMyQueue()`
- `search()` → `searchTracks()`. `searchArtists()`, etc.
- `getUserProfile()` → `getMe()`
- [more...]

## Benefits

1. **Faster builds** - No Rust Spotify deps to compile
2. **Simpler auth** - PKCE in browser, no browser popup confusion
3. **Better errors** - SDK returns clear error codes
4. **Smaller binary** - Remove librespot (~5MB of Rust code)
5. **Easier debugging** - All API calls in JS console

## Files to Change

### Frontend Changes:
- `src/lib/spotify.ts` - **Complete rewrite** using Spotify Web SDK
- `src/hooks/useAuth.ts` - PKCE OAuth flow
- `src/lib/ws-client.ts` - Remove Spotify WS commands, keep system commands

### Rust Removal:
- `src-tauri/src/spotify/` (entire directory - auth, client, device, token)
- `src-tauri/src/spotify_backend.rs`
- `src-tauri/src/actors/spotify.rs` (entire file - 1800+ lines)
- Commands from `commands.rs`: `authenticate_librespot`, `restore_librespot_session`, `clear_librespot_session`
- Remove `pub mod spotify_backend;` from `lib.rs`
- Remove `actors/spotify.rs` from lib.rs

### Rust Keep (Device Discovery & System):
- `src-tauri/src/commands.rs`: `scan_spotify_devices`, `wake_cast_device`, `diagnose_network`
- `src-tauri/src/mdns.rs` - mDNS device discovery
- `src-tauri/src/now_playing.rs` - System notifications
- `src-tauri/src/commands.rs`: `check_credentials_status` - Clear error messages
- `src-tauri/src/actors/` - Other actors (not Spotify)

### Key Insight: Simplify Architecture

Current flow (complex):
```
Frontend → WebSocket → Rust Actor → Spotify Backend → Spotify API
```

New flow (simple):
```
Frontend → Spotify Web SDK → Spotify API
          ↓
          Rust (secrets stored, devices discovered, notifications shown)
```

The Rust backend will:
1. Receive CLIENT_ID/CLIENT_SECRET at startup (for error checking)
2. Handle mDNS device discovery (Cast/Spotify Connect)
3. Show "Now Playing" notifications (system integration)
4. Provide clear credential error messages

Spotify OAuth happens entirely in browser via PKCE - no backend needed.

## Estimated Effort

- Phase 1: 1-2 hours (audit)
- Phase 2: 2-3 hours (SDK integration)
- Phase 3: 1 hour (Rust cleanup)
- Phase 4: 2 hours (auth update)
- Phase 5: 1 hour (cleanup)
- **Total: ~8-10 hours**

## Rollback Plan

If this goes wrong:
```bash
git checkout HEAD~0 -- src-tauri/src/spotify/
git checkout HEAD~0 -- src/lib/spotify.ts
```
