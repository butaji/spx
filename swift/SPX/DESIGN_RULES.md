# SPX Design Rules

## 1. Layout Architecture

### 1.1 Three-Zone Maximum
The app uses exactly three zones:
- **Left**: Sidebar navigation (80px fixed)
- **Center**: Main content area (flexible)
- **Bottom**: Player bar (68px fixed)

**Rule**: No right sidebar. No floating panels. No context panels sliding in from the right.

### 1.2 Z-Stacking Order
```
Layer 0: Background (#0a0a0a)
Layer 1: Content scroll area
Layer 2: Player bar (always on top, fixed to bottom)
Layer 3: Modal overlays (auth, loading)
```

### 1.3 Content Padding
- Horizontal: 24px from sidebar divider
- Top: 16px below window title bar
- Bottom: 28px above player bar
- No extra padding inside content cards beyond their own internal padding

---

## 2. Spacing System (8-Point Grid)

All spacing uses multiples of 4px:

| Token | Value | Usage |
|-------|-------|-------|
| x1 | 4px | Tight gaps, icon-text pairs |
| x2 | 8px | Default element spacing |
| x3 | 12px | Section internal spacing |
| x4 | 16px | Card padding, section gaps |
| x6 | 24px | Major section separation |
| x8 | 32px | Hero element spacing |

**Rule**: Never use arbitrary spacing values. Always use `SPXSpacing.*` tokens.

### 2.1 Spacing Hierarchy
```
Page sections: 24px apart
Section elements: 12px apart
Element internals: 8px apart
Icon-text pairs: 4px apart
```

---

## 3. Color System

### 3.1 Background Colors
| Token | Hex | Usage |
|-------|-----|-------|
| bg | #0a0a0a | App background, sidebar |
| bgElevated | #111111 | Player bar, cards |
| surface | #1a1a1a | Button backgrounds, placeholders |

### 3.2 Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| fg | #ffffff | Primary text, titles |
| fgSecondary | #a0a0a0 | Artist names, secondary info |
| fgMuted | #6a6a6a | Timestamps, labels, disabled |
| fgFaint | #555555 | Placeholder text |

### 3.3 Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| accent | #1DB954 | Active states, links, progress fill |
| accent opacity(0.15) | — | Active sidebar item background |

### 3.4 Border/Divider Colors
| Token | Hex | Usage |
|-------|-----|-------|
| border | #333333 | Progress track background |
| edge | white@6% | Dividers between zones |

**Rule**: Never hardcode hex values in views. Always use `SPXColors.*` tokens.

---

## 4. Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| heroTitle | 32px | Bold | Track title in hero |
| heroArtist | 16px | Regular | Artist name in hero |
| heroAlbum | 14px | Regular | Album name in hero |
| sectionTitle | 20px | Semibold | "Your Playlists" etc. |
| artistSectionTitle | 24px | Bold | Artist name in detail |
| body | 14px | Regular | General text |
| bodyBold | 14px | Bold | Emphasized text in stats |
| bodyMedium | 14px | Medium | Links like "View more on SPX" |
| caption | 12px | Regular | Card labels, timestamps |
| captionBold | 12px | Semibold | Player track name |
| captionMono | 12px | Monospaced | Time labels (6:50) |
| small | 11px | Regular | Player artist name |
| tiny | 10px | Medium | Sidebar labels |
| tag | 13px | Regular | Genre tags |
| tagLabel | 14px | Regular | "Popular tags:" label |
| buttonIcon | 16px | — | Action button icons |
| sidebarIcon | 20px | Medium | Sidebar icons |
| controlIcon | 14px | — | Player control icons |
| controlIconLarge | 20px | Medium | Play/pause button icon |
| volumeIcon | 16px | — | Volume icon |

**Rule**: Never hardcode font sizes. Always use `SPXFonts.*` tokens.

### 4.1 Text Wrapping Rules
- **Never** wrap sidebar labels. Use `.lineLimit(1)` + `.minimumScaleFactor(0.8)`
- **Never** wrap track/artist names in player bar. Use `.lineLimit(1)`
- **Never** wrap card titles. Use `.lineLimit(1)`
- Hero title: `.lineLimit(2)` maximum with truncation

---

## 5. Component Sizing

### 5.1 Artwork Sizes
| Token | Size | Corner Radius | Usage |
|-------|------|---------------|-------|
| artworkSmall | 40×40px | 4px | Player bar thumbnail |
| artworkMedium | 120×120px | 8px | Artist photo |
| artworkLarge | 280×280px | 12px | Hero album cover |

### 5.2 Card Sizes
| Token | Size | Corner Radius | Usage |
|-------|------|---------------|-------|
| playlist | 140×140px | 8px | Playlist cover |
| stats | — | 12px | Stats text card |

### 5.3 Button Sizes
| Token | Size | Shape | Usage |
|-------|------|-------|-------|
| button | 40×40px | Circle | Heart, share, link buttons |
| controlSmall | 36px wide | — | Shuffle, repeat |
| control | 40px wide | — | Prev, next |
| controlLarge | 46px wide | — | Play/pause |

### 5.4 Player Bar
- Total height: 68px
- Content row height: 54px
- Progress row: 14px (2px bar + 6px bottom padding)
- Track info: hug content (no fixed width)
- Volume section: 220px fixed
- Time labels: 32px fixed width, monospaced

**Rule**: Never use magic numbers. Always use `SPXIconSize.*` or `Constants.Layout.*`.

---

## 6. Alignment Rules

### 6.1 Horizontal Alignment
- **Left-aligned** by default (VStack alignment: .leading)
- Player bar: Three-column flex layout
  - Left: Track info (hug left)
  - Center: Controls (centered)
  - Right: Volume (hug right)
- **No** `Spacer()` between track info and heart button. Heart hugs artist name.
- **No** fixed widths on content-hugging elements.

### 6.2 Vertical Alignment
- Hero section: `.top` alignment (artwork and text align to top)
- All HStacks inside VStacks use explicit alignment

### 6.3 Centering Rules
- Only center content that is explicitly centered in the reference
- Sidebar icons: centered in their 80px container
- Player controls: centered in available space between track info and volume

---

## 7. Content Rules

### 7.1 What NOT to Show
- [ ] No user avatar in "Your Playlists" section
- [ ] No right sidebar / context panel
- [ ] No "Liked Songs" counter or library stats in home view
- [ ] No floating action buttons
- [ ] No tooltips or hover previews
- [ ] No footer in sidebar

### 7.2 What to Show
- [x] Hero: Album art + title + artist + album + progress + action buttons
- [x] Stats: "You've listened to [artist] X times and [track] Y times"
- [x] Tags: "Popular tags:" label + green tags with "·" separator
- [x] Artist: Photo + name + bio + "View more on SPX" link
- [x] Playlists: Grid of square covers with names below
- [x] Player bar: Art + track info + controls + volume + progress

---

## 8. Interactive States

### 8.1 Active State
- Sidebar item: Green icon + green text + `accent@15%` background pill
- Progress bar: Green fill for player bar style
- Play button: No background circle, just green icon

### 8.2 Hover States
- Buttons: `surfaceHover` background
- Cards: Subtle scale or opacity change

### 8.3 Disabled State
- Opacity: 50%
- No interaction

---

## 9. Progress Bars

### 9.1 Hero Progress Bar
- Height: 3px
- Track: `border` (#333333)
- Fill: `fgSecondary` (#a0a0a0)
- With time labels: "6:50" and "7:36" in `captionMono`

### 9.2 Player Progress Bar
- Height: 2px (at very bottom of player bar)
- Track: `border` (#333333)
- Fill: `accent` (#1DB954)
- With time labels: "6:50" and "7:36" in `timeLabel` (10px monospaced)

---

## 10. Image Handling

### 10.1 Aspect Ratio
- Album artwork: Square (1:1) always
- Playlist covers: Square (1:1) always
- Artist photos: Square (1:1) always

### 10.2 Fallback
- Show `surface` colored placeholder with `fgMuted` music note icon
- Never stretch or distort images

### 10.3 Loading
- Show placeholder immediately
- Fade in loaded image (no layout shift)

---

## 11. Design Token Enforcement

### 11.1 Mandatory Tokens
Every view MUST use tokens for:
- [ ] Colors (no `Color(hex: "...")` in views)
- [ ] Fonts (no `.font(.system(size: X))` in views)
- [ ] Spacing (no hardcoded `.padding(N)` in views)
- [ ] Sizes (no hardcoded `.frame(width: N)` in views)
- [ ] Corner radii (no hardcoded `.cornerRadius(N)` in views)

### 11.2 Exception
Component definitions may use raw values ONCE to define the token itself. All consumers must use the token.

---

## 12. Review Checklist

Before committing any UI change, verify:

- [ ] No elements added that aren't in the reference image
- [ ] No elements removed that are in the reference image
- [ ] All colors use SPXColors tokens
- [ ] All fonts use SPXFonts tokens
- [ ] All spacing uses SPXSpacing tokens
- [ ] All sizes use SPXIconSize or Constants tokens
- [ ] No text wrapping issues (lineLimit set)
- [ ] No floating elements without purpose
- [ ] Heart button hugs text, not pushed by Spacer
- [ ] Square artwork everywhere
- [ ] Build passes
- [ ] All 442 tests pass
- [ ] swiftlint shows 0 violations
