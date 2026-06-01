# SPX

### *The child of Spotify and Last.fm 2009* 💀

You're at your desk. It's 2009. Last.fm's desktop scrobbler is running in the background, dutifully logging every track. You know exactly how many times you've played "Archangel" by Burial (it's 478, and you remember the exact day you hit 400).

**SPX** is what happens when you take that soul and build it with **Swift + SwiftUI** — native macOS performance, real scrobbling, obsessive listening stats. Light on RAM. Heavy on nostalgia.

![SPX Screenshot](assets/screenshot.jpeg)

---

## Why SPX?

| Problem | Solution |
|---------|----------|
| Spotify desktop uses 300MB+ RAM | **Native SwiftUI** = ~50MB |
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

## Requirements

- macOS 14.0+ (Sonoma or later)
- Swift 5.9+

---

## Quick Start

```bash
cd swift/SPX
swift build
SPX_MOCK=1 swift run    # No Spotify account needed
```

Or from the repo root:

```bash
./run.sh --mock
```

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Swift 5.9 |
| UI | SwiftUI |
| Audio | AVFoundation, Spotify Web API |

---

## Architecture

```
swift/SPX/
├── SPXApp.swift           # App entry point
├── Views/                 # SwiftUI views
├── ViewModels/            # ObservableObject view models
├── Models/               # Data models
├── Networking/           # Spotify API client
└── Utilities/            # Helpers, extensions
```

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
