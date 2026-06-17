# SPX Architecture

## Frontend Structure (`src/`)

```
src/
├── components/       # UI components (PlayerBar, Sidebar, etc.)
├── screens/          # Page components (Home, Search, Library)
├── stores/           # Preact Signals state
├── hooks/            # Custom hooks (useAuth, usePlayback, useDevices)
├── lib/              # Utilities and API
└── styles/           # CSS stylesheets
```

### Key Files (`src/lib/`)

| File | Lines | Purpose |
|------|-------|---------|
| `spotify.ts` | 685 | Unified API layer: PKCE OAuth, token management, API wrapper, mock |
| `cache.ts` | 220 | Simple TTL cache for API responses |
| `request-hooks.ts` | 119 | Before/after request interceptors |
| `ws-client.ts` | 186 | WebSocket for real-time updates |
| `errors.ts` | 1710 | Centralized error handling |
| `mock.ts` | 467 | Mock data for VITE_SPX_MOCK=1 |
| `spotify-sdk.ts` | 10 | Re-exports from spotify.ts |

### State Management (`src/stores/`)

- `spotify.ts` - Auth, user profile
- `devices.ts` - Device list, local devices
- `notifications.ts` - Toast notifications
- `playback.ts` - Current track, volume

## Backend Structure (`src-tauri/src/`)

| File | Purpose |
|------|---------|
| `main.rs` | Tauri app entry, commands |
| `librespot_player.rs` | Local Spotify Connect device |
| `spotify_cast.rs` | Google Cast authentication |
| `web_player_token.rs` | Web Player token from sp_dc |
| `cookie_capture.rs` | Embedded WebView for sp_dc |
| `events.rs` | EventBus for publish-subscribe |
| `fn_utils.rs` | Functional utilities |

## Data Flow

```
User Action → Component → Hook → Store
                            ↓
                       spotify.ts (API)
                            ↓
              ┌─────────────┴─────────────┐
              ↓                           ↓
         Mock Mode                   Spotify API
              ↓                           ↓
         mock.ts                    cache.ts
                                          ↓
                                    WebSocket → Store Update → UI
```

## Key Patterns

### API Integration
```typescript
// src/lib/spotify.ts - unified layer
export async function apiCall<T>(endpoint: string): Promise<T>
export async function refreshToken(): Promise<void>
export function isAuthenticated(): boolean
```

### Request Hooks
```typescript
// src/lib/request-hooks.ts
interface RequestHook {
  before?: (req: Request) => Request | Promise<Request>
  after?: (res: Response) => Response | Promise<Response>
}
```

### Rust Events
```rust
// EventBus.publish → Frontend subscribes
SpxEvent::DeviceDiscovered(DeviceInfo)
SpxEvent::AuthCompleted { username }
SpxEvent::Error { code, message }
```

## Device Support

| Device Type | How It Works |
|-------------|--------------|
| Google Cast | sp_dc cookie → Web Player token |
| SPX Connect | librespot → local Spotify Connect |
| Spotify Connect | Standard API device activation |
