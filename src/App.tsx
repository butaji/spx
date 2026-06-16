import { useState, useCallback, useRef, useEffect, useMemo } from "preact/compat";
import Logo from "./components/Logo";
import { HotkeyHelp } from "./components/HotkeyHelp";
import { Sidebar } from "./components/Sidebar";
import { PlayerBar } from "./components/PlayerBar";
import ContextPanel from "./components/ContextPanel";
import { Notifications } from "./components/Notifications";
import Home from "./screens/Home";
import Search from "./screens/Search";
import Library from "./screens/Library";
import Queue from "./screens/Queue";
import Diagnostics from "./screens/Diagnostics";
import PlaylistDetail from "./screens/PlaylistDetail";
import AlbumDetail from "./screens/AlbumDetail";
import ArtistDetail from "./screens/ArtistDetail";
import { getAccessToken } from "./lib/spotify";
import {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  playbackProgress,
  playbackDuration,
  isPlaying,
  likedTrack,
  isMockMode,
  authError,
  userProfile,
  appError,
  contextPanelItem,
  lastPlayedTrack,
} from "./stores/spotify";
import { refreshLocalDevices } from "./stores/devices";

import { useAuth } from "./hooks/useAuth";
import { usePlayback } from "./hooks/usePlayback";
import { useDevices } from "./hooks/useDevices";
import { useKeyboard } from "./hooks/useKeyboard";
import { listen } from "@tauri-apps/api/event";

import type { View, TrackInfo } from "./types";
export type { View, TrackInfo } from "./types";

// Derived track info for components expecting flattened structure
function getDerivedTrack(): TrackInfo | null {
  const track = playbackTrack.value;
  if (track) {
    return {
      id: track.id,
      name: track.name,
      artist: track.artists?.filter(Boolean).map(a => a.name).filter(Boolean).join(", ") || "Unknown",
      artistIds: track.artists?.map(a => a.id) || [],
      album: track.album?.name || "",
      durationMs: track.duration_ms ?? 0,
      progressMs: playbackProgress.value,
      isPlaying: isPlaying.value,
      imageUrl: track.album?.images?.[0]?.url,
      uri: track.uri,
    };
  }

  const lastPlayed = lastPlayedTrack.value;
  if (lastPlayed) {
    return {
      id: lastPlayed.id || lastPlayed.uri,
      name: lastPlayed.name,
      artist: lastPlayed.artistName,
      artistIds: lastPlayed.artistId ? [lastPlayed.artistId] : [],
      album: lastPlayed.albumName,
      durationMs: 0,
      progressMs: 0,
      isPlaying: false,
      imageUrl: lastPlayed.imageUrl,
      uri: lastPlayed.uri,
    };
  }

  return null;
}

function App() {
  const isMac = /Mac/.test(navigator.userAgent);
  const [history, setHistory] = useState<View[]>([{ type: "home" }]);
  const view = history[history.length - 1];
  const pushView = (v: View) => setHistory(prev => [...prev, v]);
  const goBack = () => setHistory(prev => prev.slice(0, -1));
  const [hotkeyHelpOpen, setHotkeyHelpOpen] = useState(false);
  const hotkeyHelpOpenRef = useRef(hotkeyHelpOpen);
  hotkeyHelpOpenRef.current = hotkeyHelpOpen;
  const historyRef = useRef(history);
  historyRef.current = history;

  // Hooks
  const { isAuthed, authErr, isAuthLoad, isRestoring, handleStartAuth } = useAuth();
  const { ensureActiveDevice } = useDevices();
  const {
    isPlayActionLoading,
    handlePlayPause,
    handleNext,
    handlePrev,
    handleSeekPosition,
    handleShuffle,
    handleMuteToggle,
    handleRepeat,
    playContextFn,
    playUrisFn,
    adjustVolume,
    handleToggleLike,
    handleVolumeChange,
  } = usePlayback({ ensureActiveDevice });

  // Derived state from signals
  // Memoize by track identity so PlayerBar doesn't re-render on every progress tick.
  const track = useMemo(() => getDerivedTrack(), [
    playbackTrack.value?.id,
    isPlaying.value,
    lastPlayedTrack.value?.id,
  ]);
  const volume = playbackVolume.value;
  const shuffle = playbackShuffle.value;
  const repeat = playbackRepeat.value;
  const mockMode = isMockMode.value;
  const error = appError.value;
  const user = userProfile.value;

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

  // Setup keyboard shortcuts
  useKeyboard({
    handlePlayPause,
    handleNext,
    handlePrev,
    adjustVolume,
    handleShuffle,
    handleRepeat,
    handleToggleLike,
    handleMuteToggle,
    focusSearch,
    handleEscape,
    setHotkeyHelpOpen,
    goBack,
    setHistory,
  });

  // Debug: Press Ctrl+Shift+T to print access token to console (dev only,
  // additionally gated by VITE_SPX_DEBUG_TOKEN=1 to avoid accidental leaks).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (import.meta.env.VITE_SPX_DEBUG_TOKEN !== '1') return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        const token = getAccessToken();
        if (token) {
          console.log('Spotify Access Token (copy this):');
          console.log(token);
        } else {
          console.warn('No access token available. Please authenticate first.');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Media Session API for native macOS media keys
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

    const currentTrack = playbackTrack.value;
    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.artists?.filter(Boolean).map(a => a.name).filter(Boolean).join(", ") || "",
        album: currentTrack.album?.name || "",
        artwork: currentTrack.album?.images?.[0]?.url ? [{ src: currentTrack.album.images[0].url, sizes: '512x512', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused';
    }
  }, [handlePlayPause, handlePrev, handleNext, playbackTrack.value?.id, isPlaying.value]);

  // Tauri media-key events from the Rust backend (global shortcuts)
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await listen<{ action: string }>('media-key', (event) => {
        switch (event.payload.action) {
          case 'play_pause':
            handlePlayPause();
            break;
          case 'next':
            handleNext();
            break;
          case 'previous':
            handlePrev();
            break;
        }
      });
    };
    setup().catch(console.error);

    return () => {
      unlisten?.();
    };
  }, [handlePlayPause, handleNext, handlePrev]);

  // Show loading screen while restoring session
  if (isRestoring.value) {
    return (
      <div className="app-window">
        <div className="auth-screen">
          <div className="auth-content">
            <div className="auth-logo-wrap">
              <Logo size={140} variant="large" />
            </div>
            <h1 className="auth-title">SPX</h1>
            <p className="auth-subtitle">
              <span className="auth-subtitle-accent">Spotify</span> Remote Control
            </p>
            <div className="auth-instructions">
              <p>Restoring session...</p>
            </div>
            <div className="auth-btn-placeholder">
              <span className="spinner-small" />
              Connecting...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if ((!isAuthed || authErr) && !mockMode) {
    const isBrowser = typeof window === "undefined" || (window as any).__TAURI_INTERNALS__?.__is_spx_shim__;
    return (
      <div className="app-window">
        <div className="auth-screen">
          <div className="auth-content">
            <div className="auth-logo-wrap">
              <Logo size={140} variant="large" />
            </div>
            <h1 className="auth-title">SPX</h1>
            <p className="auth-subtitle">
              <span className="auth-subtitle-accent">Spotify</span> Remote Control
            </p>

            <div className="auth-instructions">
              <p>Control your Spotify playback from a beautiful desktop app</p>
            </div>

            {isBrowser ? (
              <BrowserConnect />
            ) : (
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
            )}

            {authErr && (
              <div className="auth-error-box">
                <p className="auth-error-title">Authentication Failed</p>
                <p className="auth-error-message">{authError.value}</p>
                <ul className="auth-error-solutions">
                  <li>Make sure you have a Spotify Premium account</li>
                  <li>Check that Spotify.com is accessible</li>
                  <li>Try clicking the button again</li>
                  <li>Allow popups if prompted by your browser</li>
                </ul>
              </div>
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
      case "diagnostics": return <Diagnostics />;

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
        onVolumeChange={handleVolumeChange}
        onToggleLike={handleToggleLike}
        onShuffle={handleShuffle}
        onRepeat={handleRepeat}
        onRefreshLocalDevices={refreshLocalDevices}
        onMuteToggle={handleMuteToggle}
      />

      {hotkeyHelpOpen && <HotkeyHelp onClose={() => setHotkeyHelpOpen(false)} />}

      {/* Error notifications */}
      <Notifications />
    </div>
  );
}

function BrowserConnect() {
  const [isLoading, setIsLoading] = useState(false);

  const handleBrowserAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const { startAuthFlow } = await import("./lib/spotify");
      await startAuthFlow();
    } catch (e) {
      console.error("[BrowserAuth] Failed to start auth:", e);
      setIsLoading(false);
    }
  }, []);

  return (
    <button
      className="btn-primary auth-btn"
      onClick={handleBrowserAuth}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <span className="spinner-small" />
          Connecting...
        </>
      ) : (
        'Connect with Spotify'
      )}
    </button>
  );
}

export default App;
