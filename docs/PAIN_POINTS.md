# SPX User Pain Points Analysis

This document analyzes potential user pain points and how SPX addresses them.

## Pain Point Categories

---

### 1. First-Time Setup 🔧

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "What is a Client ID?" | Clear onboarding screen explaining requirements |
| "Where do I get credentials?" | Link to developer.spotify.com with instructions |
| "OAuth is confusing" | Uses same proven flow as spotify-player |
| "What if it doesn't work?" | Clear error messages with setup verification |

---

### 2. Finding Features 🔍

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "Where is the queue?" | Sidebar with clear labels |
| "How do I search?" | Keyboard shortcut `[/]` and visible search tab |
| "How to change device?" | Device selector in player bar |
| "What shortcuts exist?" | `[?]` shows help modal |

---

### 3. Playback Control Issues 🎵

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "Play button does nothing" | Auto-activates SPX Player or shows device error |
| "Skip not working" | Auto-activates device or shows error |
| "Volume not changing" | Clear mute indicator, real-time feedback |
| "Can't seek" | Click-to-seek progress bar |

---

### 4. Device Confusion 📱

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "Which device is playing?" | Active device highlighted |
| "Why no devices found?" | Built-in SPX Player is always available on this Mac |
| "Device on different WiFi?" | Shows warning about network mismatch |
| "How do I switch?" | One-click device transfer |

---

### 5. Error Recovery 💔

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "What went wrong?" | Clear error title + message |
| "How do I fix it?" | Step-by-step solutions in notifications |
| "Is it my fault?" | Distinguishes network vs. user issues |
| "How to retry?" | Action button in error notification |

---

### 6. State Visibility 👁️

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "What's playing?" | Prominent Now Playing hero |
| "How much time left?" | Progress bar with timestamps |
| "Did I like it?" | Heart icon with clear state |
| "Is it shuffled?" | Shuffle button with active indicator |

---

### 7. Network Issues 🌐

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "Connection lost" | Auto-reconnect with status indicator |
| "Spotify is down?" | Diagnostic checks + status page |
| "Rate limited" | Shows countdown, suggests waiting |
| "Slow connection" | Graceful degradation, timeouts |

---

### 8. Authentication Exhaustion 🔐

| Pain Point | How SPX Solves It |
|------------|-------------------|
| "Need to sign in again?" | Session persisted, auto-restore |
| "Token expired?" | Silent refresh, shows only if fails |
| "OAuth popup blocked?" | Clear instructions to allow popup |
| "Wrong account?" | Shows current account, easy sign-out |

---

## Error Categories & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| No devices | No playback target available | Select SPX Player or another device |
| Token expired | Session timeout | Sign in again |
| Network timeout | Slow connection | Try again |
| Rate limited | Too many requests | Wait 30 seconds |
| Region blocked | Content unavailable | Try different track |
| Premium required | Free account | Upgrade to Premium |

---

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `Cmd+→` | Next track |
| `Cmd+←` | Previous track |
| `Cmd+↑` | Volume up |
| `Cmd+↓` | Volume down |
| `/` | Focus search |
| `?` | Show shortcuts |
| `Esc` | Close/Back |
| `Cmd+1-4` | Navigate tabs |

---

## System Status Indicators

The status indicator shows:

1. **🟢 Connected** - Everything working
2. **🟡 Connecting** - Reconnecting...
3. **🔴 Offline** - Connection lost

Click status to see:
- Internet connectivity
- Spotify API status  
- WebSocket status
- Last check timestamp

---

## Testing Strategy

### Unit Tests
- Individual functions work correctly
- Error categorization accurate
- State management proper

### Integration Tests
- API calls work end-to-end
- WebSocket communication
- Device discovery

### E2E Tests (Playwright + mock mode)
- User flows work
- UI is accessible
- Errors are clear
- No console errors

---

## User Journey Maps

### Happy Path
1. Launch app → See onboarding
2. Connect Spotify → OAuth flow
3. See Now Playing → Start playing
4. Browse/search → Find music
5. Control playback → Enjoy

### Error Recovery Path
1. Action fails → Toast appears
2. User reads error → Sees solution
3. User follows steps → Issue resolved
4. Continue using app

---

## Accessibility Features

- **Screen reader support** - ARIA labels on all controls
- **Keyboard navigation** - Full app usable without mouse
- **Focus indicators** - Clear focus states
- **Color contrast** - Meets WCAG guidelines
- **Error announcements** - Live regions for screen readers
