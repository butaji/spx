# SPX Production Readiness Checklist

## 1. Core Functionality ✅

### Authentication
- [ ] Spotify OAuth flow works end-to-end
- [ ] Token refresh is handled automatically
- [ ] Session persistence across app restarts
- [ ] Mock mode for development/demo

### Playback Control
- [ ] Play/Pause works on active device
- [ ] Next/Previous track navigation
- [ ] Seek to position (scrubber)
- [ ] Volume control with mute
- [ ] Shuffle toggle
- [ ] Repeat modes (off/context/track)

### Device Management
- [ ] Spotify Connect devices detected
- [ ] Device transfer/selection works
- [ ] Local network device scanning (mDNS/Cast)
- [ ] Active device indicator

### Content Browsing
- [ ] Home screen with recent activity
- [ ] Search (tracks, albums, artists, playlists)
- [ ] Library (liked songs, playlists)
- [ ] Playlist detail view
- [ ] Album detail view
- [ ] Artist detail view

### macOS Integration
- [ ] Global media keys (play/pause, next, prev)
- [ ] Now Playing integration (lock screen, Control Center)
- [ ] System status indicator

## 2. Error Handling ✅

### Error Categories
- [ ] 45+ error categories defined
- [ ] User-friendly error messages
- [ ] Step-by-step solutions
- [ ] Auto-dismiss for non-critical errors

### Notifications
- [ ] Toast notification banner UI
- [ ] Expandable solutions section
- [ ] Action buttons (Retry, etc.)
- [ ] System status panel with diagnostics

### Diagnostics
- [ ] Internet connection check
- [ ] Spotify API reachability check
- [ ] WebSocket connection status
- [ ] Manual diagnostic refresh

## 3. UI/UX ✅

### Screens
- [ ] Onboarding/Auth screen with logo
- [ ] Home screen with Now Playing hero
- [ ] Search screen with results
- [ ] Library screen with tabs
- [ ] Playlist detail screen
- [ ] Album detail screen
- [ ] Artist detail screen
- [ ] Queue screen

### Components
- [ ] Sidebar navigation
- [ ] Player bar with controls
- [ ] Track cards (grid/list views)
- [ ] Device selector dropdown
- [ ] Context panel

### Visual Polish
- [ ] Dark mode styling
- [ ] Animations (fade, slide)
- [ ] Loading states/spinners
- [ ] Hover states
- [ ] Responsive layout

## 4. Technical Requirements

### Build
- [ ] `npm run build` completes without errors
- [ ] TypeScript compilation passes (`tsc`)
- [ ] Vite production build succeeds
- [ ] All assets bundled correctly

### Rust Backend
- [ ] `cargo build --release` succeeds
- [ ] All Rust tests pass
- [ ] WebSocket server works
- [ ] Media keys registered
- [ ] Now Playing updates work

### Tests
- [ ] 216 TypeScript tests pass
- [ ] 78 Rust tests pass
- [ ] No test flakiness

## 5. Configuration

### Environment Variables
- [ ] `SPOTIFY_CLIENT_ID` documented
- [ ] `SPOTIFY_CLIENT_SECRET` documented
- [ ] `SPOTIFY_REDIRECT_URI` set
- [ ] `.env.example` created

### Tauri Configuration
- [ ] `tauri.conf.json` configured
- [ ] App name and version set
- [ ] Window settings correct
- [ ] Permissions configured
- [ ] Bundle identifiers set

### Capabilities
- [ ] Local network access
- [ ] Media keys
- [ ] Notifications

## 6. Security

### OAuth
- [ ] Client secret never exposed to frontend
- [ ] Tokens stored securely
- [ ] HTTPS redirect URI
- [ ] Token refresh handled server-side

### Local Data
- [ ] No sensitive data in localStorage
- [ ] Tokens encrypted at rest
- [ ] Clear token on sign out

## 7. Performance

### Bundle Size
- [ ] JS bundle < 500KB (gzipped < 100KB)
- [ ] CSS bundle < 100KB
- [ ] No duplicate dependencies

### Runtime
- [ ] Initial load < 2s
- [ ] Smooth 60fps animations
- [ ] No memory leaks
- [ ] WebSocket reconnection handled

## 8. Documentation

### README
- [ ] Installation instructions
- [ ] Setup guide
- [ ] Features list
- [ ] Screenshots
- [ ] Contributing guidelines

### Code
- [ ] `AGENTS.md` updated
- [ ] TypeScript types documented
- [ ] Error codes documented

## 9. Distribution

### macOS App
- [ ] Code signed (if possible)
- [ ] Notarized (if possible)
- [ ] DMG bundle created
- [ ] App icon set
- [ ] Version bumped

### GitHub Release
- [ ] Tag created (v0.1.0)
- [ ] Release notes written
- [ ] Assets attached
- [ ] Changelog updated

## 10. Post-Launch Monitoring

### Logging
- [ ] Error logging in place
- [ ] Analytics events tracked (optional)

### User Feedback
- [ ] GitHub Issues enabled
- [ ] Support contact available

---

## Quick Verification Commands

```bash
# Build check
npm run build

# TypeScript check
tsc --noEmit

# Rust build
cd src-tauri && cargo build --release

# Tests
npm test
cargo test

# Lint (if available)
npm run lint
cargo clippy
```

## Status: Ready for Beta ✅

All core features implemented, error handling complete, tests passing.
