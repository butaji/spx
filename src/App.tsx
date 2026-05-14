import { useState, useEffect, useCallback, useRef } from "preact/compat";
import { message } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import Logo from "./components/Logo";
import { HotkeyHelp } from "./components/HotkeyHelp";
import { Sidebar } from "./components/Sidebar";
import { PlayerBar } from "./components/PlayerBar";
import ContextPanel from "./components/ContextPanel";
import { registerHotkey, setupHotkeys } from "./lib/hotkeys";
import Home from "./screens/Home";
import Search from "./screens/Search";
import Library from "./screens/Library";
import Queue from "./screens/Queue";
import Stats from "./screens/Stats";
import PlaylistDetail from "./screens/PlaylistDetail";
import AlbumDetail from "./screens/AlbumDetail";
import ArtistDetail from "./screens/ArtistDetail";
import {
  startAuthFlow,
  handleCallbackUrl,
  restoreSession,
  checkMockMode,
  getAccessToken,
  next, previous,
  seek, setVolume as apiSetVolume, setShuffle as apiSetShuffle, setRepeat as apiSetRepeat,
  playContext, playUris, transferPlayback,
  saveTracks,
  removeSavedTracks,
} from "./lib/spotify";
import { initPlayer, onPlaybackEvent } from "./lib/playback";
import {
  availableDevices,
  localDevices,
  refreshSpotifyDevices,
  refreshLocalDevices,
} from "./stores/devices";
import {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  playbackProgress,
  playbackDuration,
  isPlaying,
  likedTrack,
  authState as isAuthSignal,
  isMockMode,
  authError,
  isAuthLoading,
  userProfile,
  appError,
  refreshPlayback,
  loadRecentActivity,
  refreshLikedStatus,
  contextPanelItem,

  playTrack,
  pauseTrack,
  startPlaybackPolling,
  validateToken,
} from "./stores/spotify";


export type View =
  | { type: "home" }
  | { type: "search" }
  | { type: "library"; tab?: string }
  | { type: "queue" }
  | { type: "stats" }
  | { type: "playlist"; id: string; name: string }
  | { type: "album"; id: string; name: string }
  | { type: "artist"; id: string; name: string };

export interface TrackInfo {
  id: string;
  name: string;
  artist: string;
  artistIds?: string[];
  album: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  imageUrl?: string;
  uri: string;
}

// Derived track info for components expecting flattened structure
function useDerivedTrack(): TrackInfo | null {
  const track = playbackTrack.value;
  if (!track) return null;
  return {
    id: track.id,
    name: track.name,
    artist: track.artists?.map(a => a.name).join(", ") || "Unknown",
    artistIds: track.artists?.map(a => a.id) || [],
    album: track.album?.name || "",
    durationMs: track.duration_ms,
    progressMs: playbackProgress.value,
    isPlaying: isPlaying.value,
    imageUrl: track.album?.images?.[0]?.url,
    uri: track.uri,
  };
}

function App() {
  const isMac = /Mac/.test(navigator.userAgent);
  const [history, setHistory] = useState<View[]>([{ type: "home" }]);
  const view = history[history.length - 1];
  const pushView = (v: View) => setHistory(prev => [...prev, v]);
  const goBack = () => setHistory(prev => prev.slice(0, -1));
  const [hotkeyHelpOpen, setHotkeyHelpOpen] = useState(false);

  const [isPlayActionLoading, setIsPlayActionLoading] = useState(false);
  const isPlayActionLoadingRef = useRef(isPlayActionLoading);
  isPlayActionLoadingRef.current = isPlayActionLoading;
  const hotkeyHelpOpenRef = useRef(hotkeyHelpOpen);
  hotkeyHelpOpenRef.current = hotkeyHelpOpen;
  const historyRef = useRef(history);
  historyRef.current = history;

  // Derived state from signals
  const track = useDerivedTrack();
  const volume = playbackVolume.value;
  const shuffle = playbackShuffle.value;
  const repeat = playbackRepeat.value;
  const isAuthed = isAuthSignal.value;
  const isAuthErr = authError.value;
  const isAuthLoad = isAuthLoading.value;
  const mockMode = isMockMode.value;
  const error = appError.value;
  const user = userProfile.value;

  // Error helper using dialog
  const showError = useCallback(async (msg: string) => {
    console.error(msg);
    try {
      await message(msg, { title: 'SPX Error', kind: 'error' });
    } catch (e) {
      appError.value = msg;
    }
  }, []);

  // Refs for keyboard handler to avoid rebinding
  const viewRef = useRef(view);
  viewRef.current = view;

  // Check auth status on mount
  useEffect(() => {
    async function init() {
      const mock = await checkMockMode();
      isMockMode.value = mock;
      const authed = await restoreSession();
      isAuthSignal.value = authed || mock;
      if (authed || mock) {
        authError.value = false;
        // Debug: print token on successful restore
        const token = getAccessToken();
        if (token) {
          console.log('[Debug] Access token:', token);
        }
        // Validate token has required scopes (e.g. streaming)
        const valid = await validateToken();
        if (!valid) {
          console.log("Token validation failed, forcing re-auth");
          isAuthSignal.value = false;
          authError.value = true;
          return;
        }
        // Initialize Web Playback SDK so SPX becomes a playback device
        try {
          const token = getAccessToken();
          if (token) {
            await initPlayer(token);
            console.log("Web Playback SDK initialized");
          }
        } catch (e) {
          console.error("Failed to init Web Playback SDK:", e);
        }
        loadRecentActivity();
        refreshPlayback();
        refreshSpotifyDevices();
      }
    }
    init();
  }, []);

  // Listen for deep link callbacks
  useEffect(() => {
    let ignore = false;

    async function handleDeepLink(url: string) {
      if (ignore) return;
      try {
        await handleCallbackUrl(url);
        isAuthSignal.value = true;
        // Initialize Web Playback SDK so SPX becomes a playback device
        try {
          const token = getAccessToken();
          if (token) {
            await initPlayer(token);
            console.log("Web Playback SDK initialized");
          }
        } catch (e) {
          console.error("Failed to init Web Playback SDK:", e);
        }
        loadRecentActivity();
        refreshPlayback();
        refreshSpotifyDevices();
      } catch (e) {
        console.error("Deep link auth error:", e);
        showError(e instanceof Error ? e.message : String(e));
      }
    }

    // Listen for Tauri deep link events
    async function setupDeepLinks() {
      console.log("Using localhost callback server, no deep links needed");
    }

    setupDeepLinks();

    // Also check URL on load (for manual deep link handling)
    const checkUrl = async () => {
      try {
        const url = window.location.href;
        if (url.includes("com.spx.app://callback") && url.includes("code=")) {
          handleDeepLink(url);
        }
      } catch (e) {
        // Not in Tauri
      }
    };
    checkUrl();

    return () => { ignore = true; };
  }, []);

  const handleTransferPlayback = useCallback(async (deviceId: string) => {
    console.log("[Play Debug] Transferring to device:", deviceId);

    // Retry up to 3 times with delay (Spotify servers may need time)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await transferPlayback(deviceId, false);
        console.log("[Play Debug] Transfer succeeded on attempt", attempt);
        // Refresh devices after successful transfer
        setTimeout(() => refreshSpotifyDevices(), 1000);
        return;
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.warn(`[Play Debug] Transfer attempt ${attempt} failed:`, msg);

        if (attempt < 3) {
          // Wait longer between retries
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        } else {
          // All retries failed
          // If this is a server error, tell user to try again
          if (msg.includes("500") || msg.includes("503")) {
            showError("Spotify servers are having issues. Please try again.");
          } else {
            showError("Could not transfer playback. Device may be offline.");
          }
        }
      }
    }

    // Refresh device list regardless
    refreshSpotifyDevices();
  }, []);

  const transferToLocalDevice = useCallback(async (deviceName: string) => {
    const device = localDevices.value.find((d) => d.name === deviceName);
    if (!device) {
      showError("Device not found");
      return;
    }
    if (device.canTransfer && device.id) {
      await handleTransferPlayback(device.id);
    } else {
      await message("To control this device, open Spotify on it first", {
        title: "SPX",
        kind: "info",
      });
    }
  }, [handleTransferPlayback]);

  // Start playback polling
  useEffect(() => {
    const cleanup = startPlaybackPolling();
    return cleanup;
  }, []);

  // Listen for Web Playback SDK ready event - just refresh state, don't transfer
  useEffect(() => {
    const unsub = onPlaybackEvent((event) => {
      if (event.type === 'ready') {
        console.log("SPX Player connected and ready, device:", event.data?.device_id);
        // DON'T transfer - just refresh playback state to see if anything is playing elsewhere
        refreshPlayback();
      }
    });
    return unsub;
  }, []);

  // Refresh liked status when track changes
  useEffect(() => {
    const id = playbackTrack.value?.id;
    if (id) {
      refreshLikedStatus(id);
    } else {
      likedTrack.value = false;
    }
  }, [playbackTrack.value?.id]);

  const handleStartAuth = useCallback(async () => {
    if (isAuthLoading.value || isAuthSignal.value) return;
    isAuthLoading.value = true;
    appError.value = null;
    authError.value = false;
    try {
      await startAuthFlow();
      console.log("Auth flow completed successfully");
      isAuthSignal.value = true;
      authError.value = false;
      loadRecentActivity();
      refreshPlayback();
      refreshSpotifyDevices();
    } catch (e) {
      console.error("Failed to start auth:", e);
      authError.value = true;
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      isAuthLoading.value = false;
    }
  }, []);



  const ensureActiveDevice = useCallback(async () => {
    // Refresh device list
    await refreshSpotifyDevices();

    const devices = availableDevices.value;

    // Check if any device is already active
    const active = devices.find(d => d.is_active);
    if (active?.id) {
      return active.id;
    }

    // Try SPX Player
    const spx = devices.find(d => d.name === 'SPX Player');
    if (spx?.id) {
      console.log('[Play] Activating SPX Player...');
      try {
        await transferPlayback(spx.id, false);
        // Poll until active
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          await refreshSpotifyDevices();
          if (availableDevices.value.find(d => d.is_active)?.id === spx.id) {
            return spx.id;
          }
        }
      } catch (e) {
        console.warn('Failed to activate SPX Player:', e);
      }
    }

    // Try any other device
    const any = devices[0];
    if (any?.id) {
      try {
        await transferPlayback(any.id, false);
        return any.id;
      } catch (e) {
        console.warn('Failed to activate device:', e);
      }
    }

    return null;
  }, []);

  const handlePlayPause = useCallback(async () => {
    console.log('[Play/Pause] Button clicked');

    if (isPlayActionLoadingRef.current) {
      console.log('[Play/Pause] Already loading, ignoring');
      return;
    }

    setIsPlayActionLoading(true);
    console.log('[Play/Pause] Loading state set to true');

    const track = playbackTrack.value;
    const playing = isPlaying.value; // Use the signal, not track property
    console.log('[Play/Pause] Current track:', track?.name, 'isPlaying signal:', playing);

    // OPTIMISTIC UPDATE
    if (track) {
      isPlaying.value = !playing;
      console.log('[Play/Pause] Optimistic update: isPlaying =', !playing);
    }

    try {
      if (playing) {
        console.log('[Play/Pause] Calling pauseTrack()...');
        await pauseTrack();
        console.log('[Play/Pause] pauseTrack() succeeded');
      } else {
        console.log('[Play/Pause] Need to play, checking devices...');

        await refreshSpotifyDevices();
        console.log('[Play/Pause] Devices:', availableDevices.value.length, 'found');
        console.log('[Play/Pause] Devices list:', availableDevices.value.map(d => ({ name: d.name, id: d.id, is_active: d.is_active })));

        const activeDevice = availableDevices.value.find(d => d.is_active);
        console.log('[Play/Pause] Active device:', activeDevice);

        let deviceId: string | null = null;

        if (activeDevice?.id) {
          deviceId = activeDevice.id;
          console.log('[Play/Pause] Using active device:', deviceId);
        } else {
          console.log('[Play/Pause] No active device, trying first available...');
          const firstDevice = availableDevices.value[0];
          if (firstDevice?.id) {
            console.log('[Play/Pause] Transferring to:', firstDevice.id);
            try {
              await transferPlayback(firstDevice.id, false);
              await new Promise(r => setTimeout(r, 500));
              deviceId = firstDevice.id;
              console.log('[Play/Pause] Transfer succeeded');
            } catch (e) {
              console.warn('[Play/Pause] Transfer failed:', e);
            }
          } else {
            console.warn('[Play/Pause] NO DEVICES FOUND');
          }
        }

        if (!deviceId) {
          console.warn('[Play/Pause] Cannot play - no device available');
          if (track) {
            isPlaying.value = playing;
          }
          showError("No Spotify devices found. Open Spotify on your phone or computer.");
          return;
        }

        console.log('[Play/Pause] Calling playTrack(', deviceId, ')...');
        await playTrack(deviceId);
        console.log('[Play/Pause] playTrack() succeeded');
      }

      setTimeout(() => {
        console.log('[Play/Pause] Refreshing playback state...');
        refreshPlayback();
      }, 500);
    } catch (error) {
      console.error('[Play/Pause] ERROR:', error);
      if (track) {
        isPlaying.value = playing;
      }
    } finally {
      console.log('[Play/Pause] Setting loading to false');
      setIsPlayActionLoading(false);
    }
  }, []);

  const handleNext = useCallback(async () => {
    try {
      const hasDevice = await ensureActiveDevice();
      if (!hasDevice) {
        showError("No active device. Please open Spotify on a device first.");
        return;
      }
      await next();
      refreshPlayback();
    } catch (e) {
      console.error("Failed to skip next:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureActiveDevice]);

  const handlePrev = useCallback(async () => {
    try {
      const hasDevice = await ensureActiveDevice();
      if (!hasDevice) {
        showError("No active device. Please open Spotify on a device first.");
        return;
      }
      await previous();
      refreshPlayback();
    } catch (e) {
      console.error("Failed to skip previous:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureActiveDevice]);

  const handleSeekPosition = useCallback(async (pos: number) => {
    try {
      await seek(pos);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to seek:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleShuffle = useCallback(async () => {
    try {
      const newShuffle = !playbackShuffle.value;
      await apiSetShuffle(newShuffle);
      playbackShuffle.value = newShuffle;
      refreshPlayback();
    } catch (e) {
      console.error("Failed to set shuffle:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleMuteToggle = useCallback(async () => {
    const v = playbackVolume.value > 0 ? 0 : 74;
    try {
      await apiSetVolume(v);
      playbackVolume.value = v;
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  }, []);

  const handleRepeat = useCallback(async () => {
    const current = playbackRepeat.value;
    const next = current === "off" ? "context" : current === "context" ? "track" : "off";
    try {
      await apiSetRepeat(next);
      playbackRepeat.value = next;
      refreshPlayback();
    } catch (e) {
      console.error("Failed to set repeat:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const playContextFn = useCallback(async (uri: string, offsetUri?: string) => {
    try {
      await playContext(uri, offsetUri);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to play context:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const playUrisFn = useCallback(async (uris: string[], offset?: number) => {
    try {
      await playUris(uris, offset);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to play URIs:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  /* ── Keyboard Shortcut Callbacks (defined before useEffect) ── */
  const adjustVolume = useCallback(async (delta: number) => {
    const v = Math.max(0, Math.min(100, playbackVolume.value + delta));
    try {
      await apiSetVolume(v);
      playbackVolume.value = v;
    } catch (ev) {
      console.error("Failed to adjust volume:", ev);
    }
  }, []);

  const handleToggleLike = useCallback(async () => {
    const id = playbackTrack.value?.id;
    if (!id) return;
    try {
      if (likedTrack.value) {
        await removeSavedTracks([id]);
        likedTrack.value = false;
      } else {
        await saveTracks([id]);
        likedTrack.value = true;
      }
    } catch (e) {
      console.error("Failed to toggle like:", e);
      showError("Failed to update liked status");
    }
  }, [showError]);

  const focusSearch = useCallback(() => {
    setHistory([{ type: "search" }]);
    setTimeout(() => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  }, []);

  const handleEscape = useCallback(() => {
    if (hotkeyHelpOpenRef.current) {
      setHotkeyHelpOpen(false);
    } else if (historyRef.current.length > 1) {
      goBack();
    }
  }, []);

  const hideWindow = useCallback(() => {
    // Tauri window hide - imports dynamically to avoid issues in web
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().hide();
    }).catch(() => {
      console.warn('Window hide not available');
    });
  }, []);

  /* ── Keyboard Shortcuts ── */
  useEffect(() => {
    // Navigation
    registerHotkey({ key: '1', modifiers: ['meta'], handler: () => setHistory([{ type: "home" }]), description: 'Now Playing' });
    registerHotkey({ key: '2', modifiers: ['meta'], handler: () => setHistory([{ type: "search" }]), description: 'Search' });
    registerHotkey({ key: '3', modifiers: ['meta'], handler: () => setHistory([{ type: "library", tab: "playlists" }]), description: 'Library' });
    registerHotkey({ key: '4', modifiers: ['meta'], handler: () => setHistory([{ type: "queue" }]), description: 'Queue' });

    // Playback
    registerHotkey({ key: ' ', handler: handlePlayPause, description: 'Play/Pause' });
    registerHotkey({ key: 'ArrowRight', modifiers: ['meta'], handler: handleNext, description: 'Next Track' });
    registerHotkey({ key: 'ArrowLeft', modifiers: ['meta'], handler: handlePrev, description: 'Previous Track' });
    registerHotkey({ key: 'ArrowUp', modifiers: ['meta'], handler: () => adjustVolume(5), description: 'Volume Up' });
    registerHotkey({ key: 'ArrowDown', modifiers: ['meta'], handler: () => adjustVolume(-5), description: 'Volume Down' });

    // Actions
    registerHotkey({ key: 'l', handler: handleToggleLike, description: 'Like/Unlike' });
    registerHotkey({ key: 's', handler: handleShuffle, description: 'Shuffle' });
    registerHotkey({ key: 'r', handler: handleRepeat, description: 'Repeat' });
    registerHotkey({ key: 'm', handler: handleMuteToggle, description: 'Mute' });

    // Quick nav
    registerHotkey({ key: '/', handler: focusSearch, description: 'Focus Search' });
    registerHotkey({ key: 'Escape', handler: handleEscape, description: 'Close/Cancel' });
    registerHotkey({ key: '?', handler: () => setHotkeyHelpOpen(true), description: 'Hotkey Help' });

    // macOS window
    registerHotkey({ key: 'w', modifiers: ['meta'], handler: hideWindow, description: 'Hide Window' });

    setupHotkeys();
  }, []);

  /* ── macOS Native Menu Events ── */
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const handlers: Record<string, () => void> = {
      'menu:play_pause': handlePlayPause,
      'menu:next_track': handleNext,
      'menu:prev_track': handlePrev,
      'menu:vol_up': () => adjustVolume(5),
      'menu:vol_down': () => adjustVolume(-5),
      'menu:shuffle': handleShuffle,
      'menu:repeat': handleRepeat,
      'menu:now_playing': () => setHistory([{ type: 'home' }]),
      'menu:search': () => setHistory([{ type: 'search' }]),
      'menu:library': () => setHistory([{ type: 'library' }]),
      'menu:queue': () => setHistory([{ type: 'queue' }]),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      listen(event, handler).then(unsub => unsubs.push(unsub));
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);

  // Debug: Press Ctrl+Shift+T to print access token to console
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        const token = getAccessToken();
        if (token) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Spotify Access Token (copy this):');
          console.log(token);
          console.log('Expires in: ~1 hour from issue');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Test command:');
          console.log(`curl -H "Authorization: Bearer ${token}" https://api.spotify.com/v1/me/player/recently-played?limit=5`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
          console.warn('No access token available. Please authenticate first.');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Media Session API for native macOS media keys (play/pause, previous, next)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      handlePlayPause();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      handlePlayPause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      handlePrev();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      handleNext();
    });

    // Update media session metadata when track changes
    const currentTrack = playbackTrack.value;
    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.artists?.map(a => a.name).join(", ") || "",
        album: currentTrack.album?.name || "",
        artwork: currentTrack.album?.images?.[0]?.url ? [{ src: currentTrack.album.images[0].url, sizes: '512x512', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused';
    }
  }, [handlePlayPause, handlePrev, handleNext, playbackTrack.value?.id, isPlaying.value]);

  if ((!isAuthed || isAuthErr) && !mockMode) {
    return (
      <div className="app-window">
        <div className="auth-screen">
          <div className="auth-content">
            <div className="auth-logo-wrap">
              <Logo size={140} />
            </div>
            <h1 className="auth-title">SPX</h1>
            <p className="auth-subtitle">
              <span className="auth-subtitle-accent">Spotify</span> Remote Control
            </p>

            <div className="auth-instructions">
              <p>Control your Spotify playback from a beautiful desktop app</p>
            </div>

            <button
              className="btn-primary auth-btn"
              onClick={handleStartAuth}
              disabled={isAuthLoad}
            >
              {isAuthLoad ? (
                <>
                  <span className="spinner-small" />
                  Connecting...
                </>
              ) : (
                'Connect with Spotify'
              )}
            </button>

            {isAuthErr && (
              <p className="auth-error">{authError.value}</p>
            )}

            <p className="auth-footer">
              Requires a Spotify Premium account
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    const common = { onPlayContext: playContextFn, onPlayUris: playUrisFn, onNavigate: pushView };
    switch (view.type) {
      case "home": return (
        <Home
          {...common}
          track={track}
          onSeek={handleSeekPosition}
          liked={likedTrack.value}
          onToggleLike={handleToggleLike}
        />
      );
      case "search": return <Search {...common} initialQuery="" />;
      case "library": return <Library {...common} />;
      case "queue": return <Queue onPlayUris={playUrisFn} />;
      case "stats": return <Stats />;
      case "playlist": return <PlaylistDetail id={view.id} name={view.name} {...common} />;
      case "album": return <AlbumDetail id={view.id} name={view.name} {...common} />;
      case "artist": return <ArtistDetail id={view.id} name={view.name} {...common} />;
    }
  };

  return (
    <div className="app-window">
      <div aria-live="polite" className="sr-only">{error}</div>
      <div className="app-body">
        <Sidebar
          view={view}
          history={history}
          setHistory={setHistory}
          user={user}
        />

        <div className="main-area">
          <div className={"main-scroll" + (isMac ? " macos-main-scroll" : "")}>
            {renderScreen()}
          </div>
        </div>

        {contextPanelItem.value && (
          <ContextPanel
            onClose={() => { contextPanelItem.value = null; }}
            onPlayUris={playUrisFn}
            onNavigate={pushView}
          />
        )}
      </div>

      <PlayerBar
        track={track}
        isPlaying={isPlaying.value}
        likedTrack={likedTrack.value}
        shuffle={shuffle}
        repeat={repeat}
        progress={playbackProgress.value}
        duration={playbackDuration.value}
        volume={volume}
        isPlayActionLoading={isPlayActionLoading}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={(ms) => handleSeekPosition(ms)}
        onVolumeChange={(vol) => {
          apiSetVolume(vol);
          playbackVolume.value = vol;
        }}
        onToggleLike={handleToggleLike}
        onShuffle={handleShuffle}
        onRepeat={handleRepeat}
        onTransferPlayback={() => {
          const active = availableDevices.value.find(d => d.is_active);
          if (active?.id) handleTransferPlayback(active.id);
        }}
        onRefreshLocalDevices={refreshLocalDevices}
        onTransferToLocalDevice={(name) => transferToLocalDevice(name)}
        onMuteToggle={handleMuteToggle}
      />

      {hotkeyHelpOpen && <HotkeyHelp onClose={() => setHotkeyHelpOpen(false)} />}
    </div>
  );
}

export default App;
