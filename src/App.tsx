import { useState, useCallback, useRef, useEffect } from "preact/compat";
import Logo from "./components/Logo";
import { HotkeyHelp } from "./components/HotkeyHelp";
import { Sidebar } from "./components/Sidebar";
import { PlayerBar } from "./components/PlayerBar";
import ContextPanel from "./components/ContextPanel";
import Home from "./screens/Home";
import Search from "./screens/Search";
import Library from "./screens/Library";
import Queue from "./screens/Queue";
import PlaylistDetail from "./screens/PlaylistDetail";
import AlbumDetail from "./screens/AlbumDetail";
import ArtistDetail from "./screens/ArtistDetail";
import { getAccessToken, getAuthUrl, handleCallbackFromUrl } from "./lib/spotify";
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
  authState,
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

import type { View, TrackInfo } from "./types";
export type { View, TrackInfo } from "./types";

// Derived track info for components expecting flattened structure
function getDerivedTrack(): TrackInfo | null {
  const track = playbackTrack.value;
  if (track) {
    return {
      id: track.id,
      name: track.name,
      artist: track.artists?.map(a => a.name).join(", ") || "Unknown",
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
  const track = getDerivedTrack();
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

  // Debug: Press Ctrl+Shift+T to print access token to console (dev only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        const token = getAccessToken();
        if (token) {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Spotify Access Token (copy this):');
          console.log(token);
          console.log('Expires in: ~1 hour from issue');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
          console.warn('No access token available. Please authenticate first.');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Handle OAuth callback: if URL has ?code=, exchange it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("error")) {
      handleCallbackFromUrl().then(ok => {
        if (ok) {
          authState.value = true;
          import("./stores/content").then(m => m.loadRecentActivity());
          import("./stores/playback").then(m => m.refreshPlayback());
          import("./stores/devices").then(m => m.refreshSpotifyDevices());
        }
      }).catch(e => {
        console.error("Auth callback failed:", e);
        authError.value = e.message || "Auth failed";
      });
    }
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
        artist: currentTrack.artists?.map(a => a.name).join(", ") || "",
        album: currentTrack.album?.name || "",
        artwork: currentTrack.album?.images?.[0]?.url ? [{ src: currentTrack.album.images[0].url, sizes: '512x512', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused';
    }
  }, [handlePlayPause, handlePrev, handleNext, playbackTrack.value?.id, isPlaying.value]);

  // Show loading screen while restoring session
  if (isRestoring.value) {
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
              <Logo size={140} />
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
    </div>
  );
}

function BrowserConnect() {
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    try {
      setError(null);
      const authUrl = await getAuthUrl();
      window.location.href = authUrl;
    } catch (e: any) {
      setError(e.message || "Failed to start auth");
    }
  }, []);

  return (
    <div>
      <button className="btn-primary auth-btn" onClick={handleConnect}>
        Connect with Spotify
      </button>
      {error && <p className="auth-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

export default App;
