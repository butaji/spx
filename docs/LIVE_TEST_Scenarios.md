# SPX Live UI Test Scenarios (100)

## 1. Authentication & App Boot (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Cold start without token | Open app in incognito, wait | Auth screen shown, "Sign in with Spotify" button visible |
| 2 | Cold start with valid token | Pre-seed localStorage, open app | App loads authenticated layout within 15s, Home screen shown |
| 3 | Cold start with expired token (no refresh) | Pre-seed localStorage with expired token + no refresh_token | Auth screen shown, error toast optional |
| 4 | Cold start with expired token (has refresh) | Pre-seed with expired + refresh_token | App restores silently via refresh, Home screen shown |
| 5 | Auth flow — button click | Click "Sign in", watch network tab | Redirects to Spotify OAuth URL |
| 6 | Auth flow — callback lands | Trigger callback with valid code | Token stored, app navigates to Home, success toast shown |
| 7 | Auth flow — error in callback | Callback with `?error=access_denied` | Auth screen re-shown, info toast "Sign In Cancelled" |
| 8 | Auth flow — state mismatch | Callback with wrong state param | Auth screen, error toast |
| 9 | Sign out | Sign out from user menu | Token cleared, auth screen shown, no crash |
| 10 | Safety timeout fires | Simulate slow init (>10s) | Restoring spinner dismissed, either auth screen or Home shown |

---

## 2. Now Playing — Home Screen (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 11 | Now Playing with active playback | Ensure Spotify is playing on any device | Hero card shows track name, artist, album art |
| 12 | Now Playing with paused playback | Pause Spotify externally | Hero card updates to show paused track, play icon |
| 13 | Now Playing with nothing playing | Stop all Spotify playback | "No track playing" placeholder shown, last-played track shown as fallback |
| 14 | Now Playing click → context panel | Click a track card in Now Playing | Context panel opens with track details |
| 15 | Artist name click in Now Playing | Click artist name | Navigates to Artist screen |
| 16 | Album art click in Now Playing | Click album art | Context panel opens (or album screen) |
| 17 | Play button in Now Playing card | Click play on the card | Playback starts on selected device |
| 18 | Shuffle toggle in Now Playing | Toggle shuffle | Shuffle state changes on Spotify, icon updates |
| 19 | Repeat toggle in Now Playing | Cycle through repeat states | Repeat state changes (off → context → track), icon updates |
| 20 | Progress bar is draggable | Drag the progress bar | Seek to new position, track updates |

---

## 3. PlayerBar (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 21 | Play/Pause button reflects state | Pause → check icon changes to play; Play → changes to pause | Icon always matches current state |
| 22 | Next track button works | Click Next while queue has tracks | Advances to next track, UI updates |
| 23 | Previous track button — within track | Click Prev within first 3 seconds of track | Restarts current track |
| 24 | Previous track button — past 3s | Click Prev after 3+ seconds | Goes to previous track |
| 25 | Volume slider drag | Drag volume slider | Volume changes on active device |
| 26 | Volume mute via slider | Drag to 0 | Volume muted, mute icon shown |
| 27 | Track title overflow | Play a track with very long title | Title scrolls horizontally or truncates gracefully |
| 28 | Artist name overflow | Play a track with very long artist name | Truncates with ellipsis |
| 29 | Progress bar shows correct time | Compare UI progress with actual playback position | Times match within 2s |
| 30 | Progress bar updates every second | Watch progress bar during playback | Smooth updates, no jumps |

---

## 4. Device Selector (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 31 | Device dropdown opens | Click device selector button | Dropdown appears with all devices |
| 32 | Spotify API devices listed | Open dropdown | Shows SPX Player, other active devices |
| 33 | Local Cast devices listed | Open dropdown after local scan | Shows Cast speakers (Living Room, Office, etc.) |
| 34 | Active device marked | Transfer to a device, open dropdown | Active device has checkmark or highlighted |
| 35 | Transfer to Cast device | Select a Cast speaker | 404 or Cast-wake flow triggered, playback moves |
| 36 | Transfer to SPX Player | Select SPX Player (Web SDK) | Transfer succeeds, SPX Player becomes active |
| 37 | No Cast devices on network | Disconnect Cast devices | "No local devices found" or empty Cast section |
| 38 | Device polling updates list | Wait 30s with dropdown closed | New devices appear when they come online |
| 39 | SPX Connect listed | Start SPX Connect from diagnostics/options | SPX Connect appears as a device option |
| 40 | Device selector closes on Escape | Open dropdown, press Escape | Dropdown closes, no device selected |

---

## 5. Search (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 41 | Search input is accessible | Click Search in sidebar | Search screen shown with input focused |
| 42 | Search returns tracks | Type "Radiohead", wait | Track results appear |
| 43 | Search returns artists | Type "Radiohead", switch to Artists tab | Artist results appear |
| 44 | Search returns albums | Type "Radiohead", switch to Albums tab | Album results appear |
| 45 | Search returns playlists | Type "chill", switch to Playlists tab | Playlist results appear |
| 46 | Empty search query | Clear search input | Placeholder shown, no results |
| 47 | No results found | Search for nonsense string | "No results" message shown |
| 48 | Click track in search | Click a track result | Playback starts or track added to queue |
| 49 | Click artist in search | Click an artist result | Navigates to Artist screen |
| 50 | Play context from search | Click "Play" on an album/playlist in search | Full context starts playing |

---

## 6. Library (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 51 | Library screen shows playlists | Click Library | Playlist list shown with cover art, track count |
| 52 | Library shows liked songs | Click "Liked Songs" | Liked Songs playlist shown, heart icon filled |
| 53 | Library shows artists | Switch to Artists tab | Followed artists listed |
| 54 | Library shows albums | Switch to Albums tab | Saved albums listed |
| 55 | Playlist has track count | Open a playlist | Correct number of tracks shown |
| 56 | Playlist tracks load | Open a playlist, scroll down | Tracks load progressively |
| 57 | Click track in playlist | Click a track in playlist detail | Playback starts from that track |
| 58 | Shuffle playlist from here | Click shuffle on playlist | Playlist shuffles, playback starts |
| 59 | Playlist context menu | Right-click a playlist | Context menu: Play, Shuffle, Add to Queue, Remove |
| 60 | Playlist detail breadcrumb | Open playlist, click back | Returns to Library view |

---

## 7. Queue (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 61 | Queue shows current + upcoming | Open Queue while playing | Current track + next tracks listed |
| 62 | Add track to queue | Right-click track → "Add to Queue" | Track appears at bottom of queue |
| 63 | Remove from queue | Drag or right-click → Remove | Track removed from queue |
| 64 | Reorder queue | Drag track in queue up/down | Order changes |
| 65 | Queue is empty | Stop playback, open Queue | Empty state message shown |
| 66 | Queue persists across navigation | Add to queue, navigate away, return | Queue still has same tracks |
| 67 | Clear queue | Right-click → Clear Queue | Queue cleared, current track remains |
| 68 | Click track in queue | Click upcoming track | Playback jumps to that track |
| 69 | Play next in queue | "Play Next" action | Track inserted right after current |
| 70 | Queue updated on Spotify change | Play next track externally | Queue updates to reflect |

---

## 8. Notifications & Toasts (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 71 | Success toast on sign in | Complete auth | "Signed In" success toast appears |
| 72 | Error toast on API failure | Block network, trigger API call | Error toast shown with message |
| 73 | Warning toast on expired token | Simulate expired token | Warning or error toast shown |
| 74 | Info toast on sign out | Sign out | "Signed Out" info toast shown |
| 75 | Toast auto-dismisses | Trigger any toast | Toast disappears after ~4s |
| 76 | Toast has dismiss button | Trigger a toast | "×" button visible, click dismisses |
| 77 | Multiple toasts stack | Trigger 3 toasts rapidly | Toasts stack without overlap |
| 78 | Toast action button works | Trigger toast with action button | Action button clickable, triggers retry |
| 79 | Notification permission prompt | First trigger of system notification | Browser permission prompt shown |
| 80 | System notification on track change | New track plays, system notifications allowed | Desktop notification shown |

---

## 9. Diagnostics Tab (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 81 | Diagnostics tab loads | Click Diagnostics | Diagnostics screen renders |
| 82 | Auth status shown correctly | Signed in → check Diagnostics | "Authenticated: Yes", token expiry shown |
| 83 | Token refresh button | Click "Refresh Token" | Token refreshed, expiry updated |
| 84 | Diagnostics shows device list | Open Diagnostics | Active device, all known devices listed |
| 85 | Diagnostics network ping | Run network diagnostics on a Cast IP | Shows reachable/unreachable status |
| 86 | Copy JSON button | Click "Copy JSON" | Full diagnostics JSON copied to clipboard |
| 87 | Reveal token toggle | Toggle reveal tokens | Token shown in plain text (warning) |
| 88 | Diagnostics refresh | Click Refresh | All data re-fetched |
| 89 | sp_dc status shown | Check if sp_dc cookie stored | "Stored sp_dc: Yes/No" in diagnostics |
| 90 | Backend status | Check backend section | OAuth callback status, Rust panics count |

---

## 10. Error & Edge Cases (10)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 91 | No internet during playback | Disconnect network while playing | App handles gracefully, error state shown |
| 92 | Playback blocked (no premium) | Use free account | Error toast, playback not transferred |
| 93 | Queue exhausted (last track) | Play last track in queue | Next button disabled or no-op |
| 94 | Token expires mid-session | Let token expire | App handles 401, shows auth screen or refreshes |
| 95 | Device goes offline mid-playback | Cast device disconnects | App shows device offline, offers alternatives |
| 96 | Search while loading | Type quickly, results loading | No crash, results update cleanly |
| 97 | Navigate while playback loading | Navigate during initial load | No crash, state preserved |
| 98 | Context panel while playing | Open context panel, play next | Panel stays open, content updates |
| 99 | Keyboard shortcuts work | Press Space (play/pause), Arrow keys (vol) | Controls respond |
| 100 | App survives rapid navigation | Click between screens quickly | No crash, no memory leak, state consistent |

---

## Run These With

```bash
# Pre-seed a live token
SPX_LIVE_TOKEN=your_token node live-test.mjs

# Or let it read from /tmp/spx_token.json
```
