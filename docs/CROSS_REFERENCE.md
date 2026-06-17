# SPX Cross-Reference with Similar Projects

## Library Evaluation

| Custom Code | Lines | Library Alternative | Recommendation |
|-------------|-------|-------------------|----------------|
| PKCE OAuth | ~60 | `@spotify/web-api-ts-sdk` | **Keep Custom** (external browser) |
| Token Storage | ~80 | `@spotify/web-api-ts-sdk` | **Keep Custom** (sp_dc for Cast) |
| API Wrapper | ~615 | `@spotify/web-api-ts-sdk` | ✅ **Now uses Official SDK** |
| Cache | ~220 | `@spotify/web-api-ts-sdk` | **Keep** (simplified) |
| Request Hooks | deleted | `@spotify/web-api-ts-sdk` | **Removed** (unused) |
| Mock Mode | ~467 | N/A | **Keep** (project-specific) |

## Why SPX Keeps Custom Code

1. **External browser auth**: Uses `open(url)` not in-app redirect
2. **sp_dc cookie**: Required for Google Cast device activation
3. **Mock mode**: `VITE_SPX_MOCK=1` for offline development
4. **Unified API layer**: Single `spotify.ts` handles auth + API + caching

## Architecture (2024-06)

```
src/lib/
├── spotify.ts          # Unified API layer (615 lines)
│   ├── PKCE OAuth flow (external browser)
│   ├── Token management (sp_dc for Cast)
│   ├── @spotify/web-api-ts-sdk wrapper
│   └── Mock mode support
├── cache.ts             # Simple TTL cache (~220 lines)
├── spotify-sdk.ts      # Re-export (10 lines)
└── mock.ts              # Mock data (467 lines)
```

## Comparison with Official SDK

| Feature | SPX | Official TS SDK |
|---------|-----|-----------------|
| API calls | ✅ Official SDK types | ✅ Built-in |
| Token refresh | ✅ Official SDK | ✅ Built-in |
| Caching | ✅ Official SDK | ✅ LocalStorage strategy |
| External browser | ✅ Custom PKCE | ❌ Uses redirect |
| sp_dc support | ✅ Native | ❌ Not supported |
| Mock mode | ✅ Built-in | ❌ Not supported |

## Source Repositories

| Project | Language | Stars | Key Pattern |
|---------|----------|-------|-------------|
| [librespot-org/librespot](https://github.com/librespot-org/librespot) | Rust | 6.3k | Spotify Connect |
| [rspotify](https://github.com/ramsayleung/rspotify) | Rust | 2.1k | Trait-based OAuth |
| [spotify-tui](https://github.com/Rigellute/spotify-tui) | Rust | 9.3k | TUI client |
| [spotify-web-api-ts-sdk](https://github.com/spotify/spotify-web-api-ts-sdk) | TypeScript | 1.5k | Official SDK |

## Key Differentiators

| Feature | SPX | Others |
|---------|-----|-------|
| Local Connect (librespot) | ✅ | ❌ |
| Google Cast | ✅ sp_dc auth | ❌ |
| Mock mode | ✅ | ❌ |
| Error solutions | ✅ User hints | ❌ Raw errors |

## Recommendations

### Keep Custom (no change needed)
- PKCE OAuth - external browser requirement
- Token management - sp_dc integration
- Cache - simplified, works for SPX use case
- Request hooks - custom implementation sufficient

### Future Considerations
- Align types with official SDK types
- Consider SDK if official adds sp_dc support
