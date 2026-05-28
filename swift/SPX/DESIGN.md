# SPX Design System

## Document Purpose
Single source of truth for SPX UI. All values derived from design spec.

---

## Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0A0A0A` | App background |
| `bg-elevated` | `#121212` | Cards, player bar, sidebar |
| `bg-overlay` | `#181818` | Hover states, dropdowns |
| `bg-active` | `#1A3A1A` | Active nav item fill |
| `bg-hover` | `#2A2A2A` | Hover backgrounds |
| `accent` | `#1DB954` | Primary action, progress, tags |
| `accent-hover` | `#1ED760` | Hover on accent |
| `text-primary` | `#FFFFFF` | Headings, primary labels |
| `text-secondary` | `#A7A7A7` | Metadata, inactive nav |
| `text-tertiary` | `#6A6A6A` | Disabled, timestamps |
| `fg-disabled` | `#535353` | Disabled text |
| `border-subtle` | `#2A2A2A` | Dividers, outlines |
| `border-hover` | `#333333` | Hover borders |
| `border-focus` | `#FFFFFF` | Focus rings |
| `danger` | `#FF4444` | Error states |
| `edge` | white 6% | Subtle overlays |
| `edge-light` | white 20% | Light overlays |

---

## Typography Tokens

| Token | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| `title-xl` | 32px | 700 | 1.1 | -0.02em |
| `title-lg` | 24px | 700 | 1.2 | -0.01em |
| `title-md` | 18px | 600 | 1.3 | 0 |
| `body` | 14px | 400 | 1.5 | 0 |
| `body-sm` | 12px | 400 | 1.4 | 0.01em |
| `caption` | 11px | 500 | 1.3 | 0.02em |
| `mono` | 12px | 400 | 1.4 | 0 |

Font stack: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
Mono stack: `SF Mono, Menlo, monospace`

---

## Spacing Scale (4px base)

| Token | Value |
|-------|-------|
| `x1` | 4px |
| `x2` | 8px |
| `x3` | 12px |
| `x4` | 16px |
| `x5` | 20px |
| `x6` | 24px |
| `x7` | 32px |
| `x8` | 40px |
| `x9` | 48px |
| `x10` | 64px |
| `x11` | 96px |

---

## Radius Tokens

| Token | Value |
|-------|-------|
| `radius-sm` | 4px |
| `radius-md` | 8px |
| `radius-lg` | 12px |
| `radius-xl` | 16px |
| `radius-full` | 9999px |

---

## Layout

### Grid System

- **Sidebar**: 80px fixed width. Icons 24px, labels caption size. Collapsible to 64px at <1280px if needed.
- **Main**: Fluid content area. Padding `24px` (desktop), `16px` (tablet).
- **Player bar**: Fixed 80px height, bottom of screen, z-index 50.
- **Content max-width**: None. Content flows full width with internal max-width containers for text blocks (640px).

### Breakpoints

| Name | Width | Behavior |
|------|-------|----------|
| `compact` | <768px | Stack sidebar into bottom nav (64px). Player bar stays. |
| `medium` | 768–1280px | Sidebar 80px. 2-column grids. |
| `wide` | >1280px | Sidebar 80px. 3–6 column grids. |

---

## Components

### Nav Item (Sidebar)

```
Container: 80px × 64px, flex-col, center, gap 4px
Icon: 24px, stroke 1.5px, color text-secondary
Label: caption, text-secondary
Active: icon + label → accent, container bg-active, radius-md
Hover (inactive): text-primary, no bg change
```

### Album Art

```
Size: fluid (1:1 aspect)
Radius: radius-xl (16px)
Fallback: bg-elevated + centered note icon (text-tertiary)
Overlay (hover): bg-base @ 40% + play button (accent, 48px, radius-full)
```

### Progress Bar

```
Track: 4px height, radius-full, bg border-subtle
Fill: accent, same height
Thumb (hover only): 12px circle, accent, shadow none
Time labels: mono, text-tertiary, flanking bar
```

### Icon Button

```
Size: 32px or 40px container
Icon: 20px or 24px, stroke 1.5px
State default: text-secondary
State hover: text-primary
State active: accent (if toggle) or scale(0.95)
```

### Artist Card

```
Layout: row, gap 16px, align center
Image: 80px × 80px, radius-lg
Text stack: title-md (name), body-sm (followers + link)
Link color: accent, hover underline
```

### Playlist Chip

```
Size: 160px × 160px (grid cell)
Image: radius-md, 1:1
Title: body, 1 line truncate, below image
Hover: overlay + play button (same as Album Art)
```

### Player Bar

```
Height: 80px
Layout: 3-zone flex (1:1:1)
Left: Mini art (56px, radius-sm) + title/artist stack
Center: Prev/Play/Next + Progress
Right: Queue toggle + Volume slider + Device picker
Background: bg-elevated, border-top 1px border-subtle
```

### Tag

```
Padding: 4px 8px
Text: caption, accent
Background: transparent
Hover: bg-active, radius-sm
```

---

## Patterns

### Now Playing View

- **Hero**: Album art left (max 400px), meta right.
- **Meta stack**: title-xl, artist link, album line, tags row, action row (heart, share, add).
- **Stats bar**: bg-overlay, radius-lg, padding 16px. "You've listened to **Artist** X times and **Track** Y times." Bold on names.
- **Below**: Artist bio card, then "Your Playlists" horizontal scroll.

### Data Density

- Grid gaps: 16px (compact), 24px (wide).
- Text always truncates with ellipsis. Max 2 lines for descriptions.
- Images lazy-load with 200ms fade-in.

### Empty / Loading

- **Skeleton**: bg-elevated pulsing to bg-hover, radius per component.
- **Empty state**: Centered icon (48px, text-tertiary) + body-sm + accent CTA.

---

## Motion

| Interaction | Duration | Easing |
|------------|----------|--------|
| Hover brightness | 150ms | ease-out |
| Active scale | 100ms | ease-in-out |
| Page transition | 200ms | ease-out |
| Progress drag | 0ms | linear (direct) |
| Sidebar collapse | 250ms | cubic-bezier(0.4, 0, 0.2, 1) |

No blur/backdrop-filter. GPU-only transforms (`opacity`, `transform`).

---

## Accessibility

- **Focus rings**: 2px solid `border-focus`, offset 2px.
- **Min touch**: 44×44px for all interactive elements.
- **Color contrast**: `text-secondary` on `bg-elevated` ≥ 4.5:1. `accent` on `bg-base` ≥ 3:1 (large text only).
- **Reduced motion**: Disable all transitions, instant state changes.

---

## Token File Structure (Scale)

```
tokens/
  color.json      // Hex values, dark mode only for now
  type.json       // Size/weight/line/letter
  space.json      // 4px scale
  radius.json
  motion.json
components/
  button.json     // Composed from tokens
  input.json
  card.json
themes/
  dark.json       // Aliased token map
```

All components reference tokens, never raw values. Adding light mode later = swap theme file, zero component edits.

---

## Token Reference (Swift)

```swift
// Dynamic color helper (OS-aware light/dark)
private func dynamicColor(dark: String, light: String) -> Color {
    Color(nsColor: NSColor(name: nil, dynamicProvider: { appearance in
        let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        let hex = isDark ? dark : light
        return NSColor(hex: hex)
    }))
}

enum SPXColors {
    // MARK: - Backgrounds
    static let bgBase = dynamicColor(dark: "0A0A0A", light: "FFFFFF")
    static let bgElevated = dynamicColor(dark: "121212", light: "FFFFFF")
    static let bgOverlay = dynamicColor(dark: "181818", light: "EEEEEE")
    static let bgActive = dynamicColor(dark: "1A3A1A", light: "E8E8E8")
    static let bgHover = dynamicColor(dark: "2A2A2A", light: "E8E8E8")

    // MARK: - Text
    static let textPrimary = dynamicColor(dark: "FFFFFF", light: "121212")
    static let textSecondary = dynamicColor(dark: "A7A7A7", light: "666666")
    static let textTertiary = dynamicColor(dark: "6A6A6A", light: "999999")
    static let fgDisabled = dynamicColor(dark: "535353", light: "BBBBBB")

    // MARK: - Accent
    static let accent = Color(hex: "1DB954")
    static let accentHover = Color(hex: "1ED760")
    static let danger = Color(hex: "FF4444")

    // MARK: - Borders
    static let borderSubtle = dynamicColor(dark: "2A2A2A", light: "E0E0E0")
    static let borderFocus = Color(hex: "FFFFFF")
    static let borderHover = dynamicColor(dark: "333333", light: "CCCCCC")
    static let edge = dynamicColor(dark: "FFFFFF", light: "000000").opacity(0.06)
    static let edgeLight = dynamicColor(dark: "FFFFFF", light: "000000").opacity(0.2)

    // MARK: - Backward Compatibility Aliases
    // (Not listed here - internal migration helpers only)
}

enum SPXFonts {
    static let titleXL = Font.system(size: 32, weight: .bold)
    static let titleLG = Font.system(size: 24, weight: .bold)
    static let titleMD = Font.system(size: 18, weight: .semibold)
    static let body = Font.system(size: 14, weight: .regular)
    static let bodySM = Font.system(size: 12, weight: .regular)
    static let caption = Font.system(size: 11, weight: .medium)
    static let mono = Font.system(size: 12, design: .monospaced)
}

enum SPXSpacing {
    static let x1: CGFloat = 4
    static let x2: CGFloat = 8
    static let x3: CGFloat = 12
    static let x4: CGFloat = 16
    static let x5: CGFloat = 20
    static let x6: CGFloat = 24
    static let x7: CGFloat = 32
    static let x8: CGFloat = 40
    static let x9: CGFloat = 48
    static let x10: CGFloat = 64
    static let x11: CGFloat = 96
}

enum SPXRadius {
    static let sm: CGFloat = 4
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let full: CGFloat = 9999
}

enum SPXIconSize {
    static let iconButtonSm: CGFloat = 32
    static let iconButtonMd: CGFloat = 40
    static let iconSizeSm: CGFloat = 20
    static let iconSizeMd: CGFloat = 24
}

enum SPXSize {
    static let sidebarWidth: CGFloat = 80
    static let playerBarHeight: CGFloat = 80
    static let playerBarMiniArt: CGFloat = 56
    static let playlistArtwork: CGFloat = 160
    static let artistPhoto: CGFloat = 80
    static let userAvatar: CGFloat = 60
    static let actionButton: CGFloat = 40
    static let volumeSectionWidth: CGFloat = 220
    static let volumeSliderWidth: CGFloat = 80
    static let timeLabelWidth: CGFloat = 32
}
```

> **Note**: Colors.swift includes backward compatibility aliases (`bg`, `surface`, `fg`, `fgSecondary`, etc.) for migration from older code. These are implementation details, not primary design tokens.

(End of file)
