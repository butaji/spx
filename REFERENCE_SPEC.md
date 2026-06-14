# SPX Music Player — Pixel-Perfect Reference Specification

## Window Chrome
- **Type:** Standard macOS title bar, opaque
- **Traffic lights:** Positioned at top-left of window
- **No custom styling applied**

---

## Sidebar (Left Panel)

| Property | Value |
|---|---|
| Width | ~80–85px |
| Background | `#0a0a0a` (very dark, nearly black) |
| Top padding | ~12px from window top |
| Item spacing | ~4px between icon and label |
| Icon size | ~20–22px |
| Label font size | ~10px |
| Label font weight | Medium (500) |

### States

| State | Background | Text Color | Icon Color |
|---|---|---|---|
| Active | Green pill/rounded rect at ~15% opacity, corner radius ~8px | `#1DB954` (green) | `#1DB954` |
| Inactive | None | `#888888` (medium gray) | `#888888` |

---

## Content Area

| Property | Value |
|---|---|
| Left padding from sidebar | ~24px |
| Top padding from title bar | ~16px |
| Right padding | ~24px |
| Bottom padding above player | ~0px (content extends to player edge) |

---

## Hero Section

### Album Artwork
| Property | Value |
|---|---|
| Dimensions | 280×280px |
| Corner radius | 12px |
| Spacing to text | ~24px |

### Title & Metadata
| Element | Font | Weight | Size | Color |
|---|---|---|---|---|
| Album title ("Honeydew") | — | Bold (700) | 32px | `#FFFFFF` |
| Artist line ("by Mr. Scruff, Feebi") | — | Regular (400) | 16px | `#A0A0A0` |
| Album line ("from Keep It Unreal...") | — | Regular (400) | 14px | `#6A6A6A` |

### Progress Bar
| Property | Value |
|---|---|
| Height | 3px |
| Track background | `#333333` |
| Fill color | `#A0A0A0` |
| Time labels | 12px monospaced, color `#6A6A6A` |

### Action Buttons
| Property | Value |
|---|---|
| Dimensions | 40×40px circular |
| Background | `#1A1A1A` |
| Icon size | 16px |

---

## Stats Card

| Property | Value |
|---|---|
| Background | `#111111` or `#161616` |
| Corner radius | 12px |
| Padding | 16px |
| Text size | 14px regular |
| Text color | `#FFFFFF` / `#A0A0A0` (mixed) |
| Bold elements | Artist and track names (700 weight) |

---

## Tags Section

| Property | Value |
|---|---|
| "Popular tags:" label | 14px, color `#6A6A6A` |
| Tag text | 13px, color `#1DB954` |
| Separators | ` · ` in `#6A6A6A` |

---

## Artist Section

### Header
| Property | Value |
|---|---|
| Name "Mr. Scruff" | 24px Bold (700) white |

### Photo
| Property | Value |
|---|---|
| Dimensions | 120×120px |
| Corner radius | 8px |

### Bio
| Property | Value |
|---|---|
| Text | 14px Regular (400), `#A0A0A0` |
| Followers count | Bold white |

### Link
| Property | Value |
|---|---|
| "View more on SPX" | 14px Medium (500), `#1DB954` |

---

## Playlists Section

### Header
| Property | Value |
|---|---|
| Text "Your Playlists" | 20px Semi-bold (600) white |

### User Avatar
| Property | Value |
|---|---|
| Dimensions | 60×60px |
| Shape | Circle |

### Playlist Cards
| Property | Value |
|---|---|
| Card dimensions | ~160×100px images |
| Corner radius | 8px |
| Label below | 12px Regular (400) white |

---

## Player Bar

| Property | Value |
|---|---|
| Height | 68px |
| Background | `#111111` or `#0F0F0F` |
| Content padding | ~16px horizontal |

### Track Info
| Element | Size | Weight | Color |
|---|---|---|---|
| Track title | 12px | Semi-bold (600) | `#FFFFFF` |
| Artist name | 11px | Regular (400) | `#888888` |
| Heart icon | 16px | — | — |

### Artwork
| Property | Value |
|---|---|
| Dimensions | 40×40px |
| Corner radius | 4px |

### Controls
| Control | Icon Size |
|---|---|
| Shuffle | 14px |
| Previous | 18px |
| Play/Pause | 22px |
| Next | 18px |
| Repeat | 14px |

### Play Button
- **No background circle** — just larger icon (22px vs 18px for prev/next)

### Progress Bar (Player)
| Property | Value |
|---|---|
| Height | 2–3px |
| Position | Spans full width at bottom |
| Track background | `#333333` |
| Fill color | `#1DB954` |

### Time Labels
| Property | Value |
|---|---|
| Font | Monospaced |
| Size | 10–11px |
| Color | `#6A6A6A` |
| Position | At bar ends |

### Volume Controls
| Element | Size |
|---|---|
| Device icon | 14px |
| Volume icon | 16px |
| Volume slider | 80px |

---

## Color Palette Summary

| Token | Hex | Usage |
|---|---|---|
| Primary Green | `#1DB954` | Active states, accents, play progress |
| Near Black (sidebar) | `#0A0A0A` | Sidebar background |
| Card Background | `#111111` / `#161616` | Cards, player bar |
| Dark Surface | `#1A1A1A` | Action buttons |
| Divider/Track BG | `#333333` | Progress bar tracks |
| Text Primary | `#FFFFFF` | Titles, main text |
| Text Secondary | `#A0A0A0` | Descriptions, artist names |
| Text Muted | `#6A6A6A` | Labels, timestamps |
| Text Inactive | `#888888` | Inactive sidebar items |

---

## Typography Summary

| Context | Size | Weight |
|---|---|---|
| Album title | 32px | Bold (700) |
| Artist header | 24px | Bold (700) |
| Section header | 20px | Semi-bold (600) |
| Body/description | 14px | Regular (400) |
| Label/tag text | 13–14px | Regular/Medium |
| Sidebar label | 10px | Medium (500) |
| Track title | 12px | Semi-bold (600) |
| Time/code | 10–12px | Regular (monospaced) |

---

## Spacing Summary

| Context | Value |
|---|---|
| Sidebar top padding | 12px |
| Sidebar item gap | 4px |
| Content left/right padding | 24px |
| Content top padding | 16px |
| Hero: artwork to text | 24px |
| Card padding | 16px |
| Card corner radius | 12px |
| Album artwork corner radius | 12px |
| Button size | 40×40px |
| Button icon | 16px |
| Player height | 68px |
| Small artwork corner radius | 4px |
