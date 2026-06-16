# AGENTS.md - SPX Development Guide

## Project Overview

**SPX** is a retro-styled Spotify remote control for macOS, built with:
- **Frontend:** Preact + TypeScript + Vite
- **Backend:** Rust (Tauri 2) + Tokio + WebSocket
- **Testing:** Vitest (TypeScript) + Cargo tests (Rust)

## Key Commands

```bash
# Development
npm run tauri dev          # Run full app
npm run dev                # Vite only (browser mode)

# Building
npm run build              # Frontend build
npm run tauri build       # Full app bundle

# Testing
npm test                   # All tests
cargo test                 # Rust tests only

# Linting
cargo clippy              # Rust linter
```

## Architecture

### Frontend (`src/`)

| Directory | Purpose |
|-----------|---------|
| `components/` | UI components (PlayerBar, Sidebar, Notifications, etc.) |
| `screens/` | Page components (Home, Search, Library, etc.) |
| `stores/` | Preact Signals state management |
| `hooks/` | Custom React hooks (useAuth, usePlayback, useDevices) |
| `lib/` | Utilities (spotify.ts, ws-client.ts, errors.ts) |
| `styles/` | CSS stylesheets |

### Backend (`src-tauri/`)

| Directory | Purpose |
|-----------|---------|
| `src/` | Rust source (main.rs, actors, spotify_backend, librespot_player) |
| `capabilities/` | Tauri permissions |

#### librespot Integration

SPX can create a local Spotify Connect device using `librespot` crates:

- `src-tauri/src/librespot_player.rs` — creates a `librespot_core::Session`, `librespot_playback::Player`, and `librespot_connect::Spirc` device.
- `src-tauri/src/commands.rs` — exposes `start_local_connect_device` to the frontend.
- `src/stores/devices.ts` — `startLocalConnectDevice()` triggers the backend and surfaces "SPX Connect" in the device list.

The access token must include the `streaming` scope and must not be expired. A token obtained via SPX's existing PKCE browser flow works; `librespot-oauth` is also available as an alternative (`authenticate_librespot_oauth`).

**Cast device support:** Google Cast receivers require a Spotify Web Player access token. SPX can obtain one in two ways:

1. **Embedded WebView login** (recommended) — click the cookie/login button in the device selector. SPX opens a Spotify login window, captures the `sp_dc` cookie automatically, and stores it in the Tauri store.
2. **Manual cookie** — set the `SPOTIFY_SP_DC` environment variable to the `sp_dc` cookie from an authenticated `https://open.spotify.com` session.

- `src-tauri/src/web_player_token.rs` — fetches a Web Player token from `open.spotify.com/api/token` using `sp_dc` + TOTP.
- `src-tauri/src/cookie_capture.rs` — embedded WebView that captures and persists `sp_dc`.
- `src-tauri/src/spotify_cast.rs` — implements the modern Cast auth flow: `setCredentials` → `getInfo` → `spclient.wg.spotify.com/device-auth/v1/refresh` → `addUser`. This is the same flow used by Spotcast / pychromecast.
- `src-tauri/src/commands.rs` — `authenticate_cast_device_command` / `authenticate_cast_device_raw_command` automatically use the Web Player token when a stored or env-var `sp_dc` is available.

If no `sp_dc` is available, Cast activation falls back to the supplied access token (which fails for most Cast devices). In that case `selectDevice()` falls back to SPX Connect so playback still works on the local Mac.

## State Management

Uses Preact Signals for reactive state:

- `stores/spotify.ts` - Auth, playback state, user profile
- `stores/devices.ts` - Device list, local devices
- `stores/notifications.ts` - Toast notifications, system status
- `stores/playback.ts` - Playback state (track, volume, etc.)

## Error Handling

All errors should use the centralized error system:

```typescript
import { handleError, ErrorCategory } from './lib/errors';

// In hooks or components
try {
  await someOperation();
} catch (e) {
  handleError(e, 'Context Name');
}
```

### Error Categories

Located in `src/lib/errors.ts`:

- `AUTH_*` - Authentication issues
- `NETWORK_*` - Connectivity issues
- `DEVICE_*` - Device/player issues
- `PLAYBACK_*` - Playback control issues
- `SYSTEM_*` - System/permission issues

### Notifications

Use `stores/notifications.ts` for user-facing messages:

```typescript
import { showError, showWarning, showSuccess } from './stores/notifications';

showError('Title', 'Message', {
  solution: ['Step 1', 'Step 2'],
  action: { label: 'Retry', onClick: () => {} }
});
```

## Testing

### Frontend Tests

```bash
npm test  # Run all tests
npm run test:watch  # Watch mode
```

Tests are in `src/**/*.test.ts` files.

### Rust Tests

```bash
cargo test
cargo test --lib  # Library tests only
```

Tests are in `src-tauri/src/**/*.rs` files.

## Common Patterns

### Adding a New Feature

1. Create component in `src/components/`
2. Add to appropriate screen in `src/screens/`
3. Add state in appropriate store in `src/stores/`
4. Add tests
5. Update this file if adding new patterns

### Error Handling Pattern

```typescript
// In hooks
const handleAction = async () => {
  try {
    setLoading(true);
    await doSomething();
  } catch (e) {
    handleError(e, 'ActionContext');
  } finally {
    setLoading(false);
  }
};
```

### Using Signals

```typescript
import { signal } from '@preact/signals';

// Define
export const myState = signal<Type>(defaultValue);

// Use in component
const value = myState.value;
myState.value = newValue;
```

## File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `PlayerBar.tsx`)
- Hooks: `camelCase.ts` (e.g., `useAuth.ts`)
- Stores: `camelCase.ts` (e.g., `spotify.ts`)
- Utilities: `camelCase.ts` (e.g., `ws-client.ts`)
- Styles: `SameName.module.css` for component CSS modules

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | Spotify Developer App Client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify Developer App Client Secret |
| `VITE_SPOTIFY_REDIRECT_URI` | No | OAuth redirect (default: `http://127.0.0.1:1422/callback`) |
| `SPOTIFY_SP_DC` | No | Spotify Web Player `sp_dc` cookie; enables direct Google Cast activation |
| `VITE_SPX_MOCK` | No | Set to "1" for mock mode |
| `VITE_SPX_DIAGNOSTICS` | No | Set to "1" to show the Diagnostics tab in the sidebar |

## Tauri Commands

Available Rust commands exposed to frontend:

```rust
// In src-tauri/src/main.rs
#[tauri::command]
fn command_name() -> Result<Type, String> {
    // ...
}
```

## API Integration

Spotify API is accessed via:
- `src/lib/spotify.ts` - Main API client (rspotify wrapper)
- `src/lib/ws-client.ts` - WebSocket for real-time updates

## Known Issues

- mDNS/Cast device discovery requires local network permission
- Global media keys require Accessibility permission on first use
- Token refresh happens automatically but may require re-auth on expiry

## Version

- App: `0.1.0`
- Tauri: `2.x`
- Preact: `10.x`
- Rust: `1.77+`
