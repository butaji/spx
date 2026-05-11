import { useState, useEffect, useCallback, useRef } from "preact/compat";
import type { MouseEvent, CSSProperties } from "preact/compat";
import { message } from "@tauri-apps/plugin-dialog";
import Logo from "./components/Logo";
import Home from "./screens/Home";
import Search from "./screens/Search";
import Library from "./screens/Library";
import Queue from "./screens/Queue";
import PlaylistDetail from "./screens/PlaylistDetail";
import AlbumDetail from "./screens/AlbumDetail";
import ArtistDetail from "./screens/ArtistDetail";
import DeviceSelector from "./components/DeviceSelector";
import {
  startAuthFlow,
  handleCallbackUrl,
  isAuthenticated,
  logout,
  checkMockMode,
  getPlaybackState, play, pause, next, previous,
  seek, setVolume as apiSetVolume, setShuffle as apiSetShuffle, setRepeat as apiSetRepeat, getUserProfile,
  playContext, playUris, getAvailableDevices, transferPlayback
} from "./lib/spotify";
import type { SpotifyDevice } from "./types";

export type View =
  | { type: "home" }
  | { type: "search" }
  | { type: "library"; tab?: string }
  | { type: "queue" }
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

const SIDEBAR_VIEWS: { view: View; label: string }[] = [
  { view: { type: "home" }, label: "Now Playing" },
  { view: { type: "search" }, label: "Search" },
  { view: { type: "library", tab: "playlists" }, label: "Library" },
  { view: { type: "queue" }, label: "Queue" },
];

export function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ── Icons ── */
function IconHome({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"}/>
      <rect x="14" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"}/>
      <rect x="3" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"}/>
      <rect x="14" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"}/>
    </svg>
  );
}
function IconSearch() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
}
function IconLibrary() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
}
function IconQueue() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v12M6 12h12"/></svg>;
}
export function IconPlay() {
  return <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
export function IconPause() {
  return <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
}
function IconPrev() {
  return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>;
}
function IconNext() {
  return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>;
}
export function IconHeart({ filled }: { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
}
function IconVolume({ muted }: { muted?: boolean }) {
  if (muted) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>;
}
function IconShuffle({ active }: { active?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>;
}
function IconRepeat({ mode }: { mode: string }) {
  const c = mode !== "off" ? "var(--accent)" : "currentColor";
  return <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>{mode === "track" && <text x="12" y="15" textAnchor="middle" fill={c} stroke="none" fontSize="10" fontWeight="bold">1</text>}</svg>;
}

function App() {
  const isMac = /Mac/.test(navigator.userAgent);
  const [history, setHistory] = useState<View[]>([{ type: "home" }]);
  const view = history[history.length - 1];
  const canGoBack = history.length > 1;
  const pushView = (v: View) => setHistory(prev => [...prev, v]);
  const goBack = () => setHistory(prev => prev.slice(0, -1));
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(74);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "context" | "track">("off");
  const [liked, setLiked] = useState(false);
  const [user, setUser] = useState<{ name: string; image?: string } | null>(null);
  const [availableDevices, setAvailableDevices] = useState<SpotifyDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<SpotifyDevice | null>(null);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const [callbackUrl, setCallbackUrl] = useState("");

  // Error helper using dialog
  const showError = useCallback(async (msg: string) => {
    console.error(msg);
    try {
      await message(msg, { title: 'SPX Error', kind: 'error' });
    } catch (e) {
      setError(msg);
    }
  }, []);

  // Rate limiting: exponential backoff state
  const [pollInterval, setPollInterval] = useState(1500);
  const pollIntervalRef = useRef(1500);
  pollIntervalRef.current = pollInterval;

  // Refs for keyboard handler to avoid rebinding
  const trackRef = useRef(track);
  const volumeRef = useRef(volume);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  const isAuthedRef = useRef(isAuthed);
  const viewRef = useRef(view);

  trackRef.current = track;
  volumeRef.current = volume;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;
  isAuthedRef.current = isAuthed;
  viewRef.current = view;

  // Check auth status on mount
  useEffect(() => {
    async function init() {
      const mock = await checkMockMode();
      setIsMockMode(mock);
      const authed = isAuthenticated();
      setIsAuthed(authed || mock);
      if (authed || mock) {
        loadUser();
        fetchPlayback();
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
          setIsAuthed(true);
          loadUser();
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

  const loadUser = useCallback(async () => {
    try {
      const data = await getUserProfile();
      setUser({ name: data.display_name || "User", image: data.images?.[0]?.url });
    } catch (e) {
      console.error("Failed to load user profile:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const data = await getAvailableDevices();
      const newDevices = data.devices || [];
      console.log("Devices found:", newDevices.length, newDevices.map(d => d.name));
      // Replace device list entirely - Spotify only returns currently available devices
      setAvailableDevices(newDevices);
    } catch (e) {
      console.error("Failed to load devices:", e);
    }
  }, []);

  const fetchPlayback = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const data = await getPlaybackState();
      if (data?.item) {
        const item = data.item as { id: string; name: string; artists?: { name: string; id: string }[]; album?: { name: string; images?: { url: string }[] }; duration_ms?: number; uri?: string };
        setTrack({
          id: item.id,
          name: item.name,
          artist: item.artists?.map((a) => a.name).join(", ") || "Unknown",
          artistIds: item.artists?.map((a) => a.id) || [],
          album: item.album?.name || "",
          durationMs: item.duration_ms || 0,
          progressMs: data.progress_ms || 0,
          isPlaying: data.is_playing || false,
          imageUrl: item.album?.images?.[0]?.url,
          uri: item.uri || "",
        });
        setShuffle(data.shuffle_state || false);
        setRepeat((data.repeat_state || "off") as "off" | "context" | "track");
        if (data.device) {
          setVolume(data.device.volume_percent || 0);
          setActiveDevice(data.device as SpotifyDevice);
        }
      }
      setError(null);
      // Reset poll interval on success after rate limit
      setPollInterval(1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Detect auth errors (401, 403, "Not authenticated")
      if (msg.includes("Not authenticated") || msg.includes("401") || msg.includes("403")) {
        console.warn("Auth error detected, forcing re-auth");
        setIsAuthed(false);
        setAuthError(true);
        logout();
        return;
      }
      // Detect rate limit (429)
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
        const newInterval = Math.min(pollIntervalRef.current * 2, 30000);
        setPollInterval(newInterval);
        console.warn("Rate limited, increasing poll interval to", newInterval);
      } else {
        console.error("Failed to fetch playback:", e);
        showError(msg);
      }
    }
  }, [isAuthed]);

  const handleTransferPlayback = useCallback(async (deviceId: string) => {
    try {
      await transferPlayback(deviceId);
      setShowDevicePicker(false);
      // Refresh after transfer
      setTimeout(() => {
        fetchPlayback();
        loadDevices();
      }, 500);
    } catch (e) {
      console.error("Failed to transfer playback:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback, loadDevices]);

  useEffect(() => {
    const id = setInterval(fetchPlayback, pollInterval);
    return () => clearInterval(id);
  }, [fetchPlayback, pollInterval]);

  useEffect(() => {
    if (!isAuthed) return;
    loadDevices();
    const id = setInterval(loadDevices, 3000);
    return () => clearInterval(id);
  }, [isAuthed, loadDevices]);

  const handleStartAuth = useCallback(async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    setError(null);
    try {
      await startAuthFlow();
      console.log("Auth flow completed successfully");
      setIsAuthed(true);
      loadUser();
    } catch (e) {
      console.error("Failed to start auth:", e);
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAuthLoading(false);
    }
  }, [isAuthLoading, loadUser]);

  const handleSubmitCallback = useCallback(async (e: Event) => {
    e.preventDefault();
    if (!callbackUrl.trim()) return;
    try {
      await handleCallbackUrl(callbackUrl.trim());
      setIsAuthed(true);
      setCallbackUrl("");
      loadUser();
    } catch (e) {
      console.error("Failed to process callback:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [callbackUrl, loadUser]);

  const handlePlayPause = useCallback(async () => {
    if (!trackRef.current) return;
    try {
      if (trackRef.current.isPlaying) {
        await pause();
      } else {
        await play();
      }
      fetchPlayback();
    } catch (e) {
      console.error("Failed to play/pause:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const handleNext = useCallback(async () => {
    try {
      await next();
      fetchPlayback();
    } catch (e) {
      console.error("Failed to skip next:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const handlePrev = useCallback(async () => {
    try {
      await previous();
      fetchPlayback();
    } catch (e) {
      console.error("Failed to skip previous:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const handleSeek = useCallback(async (e: MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = Math.floor(((e.clientX - rect.left) / rect.width) * trackRef.current.durationMs);
    try {
      await seek(pos);
      fetchPlayback();
    } catch (e) {
      console.error("Failed to seek:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const handleSeekPosition = useCallback(async (pos: number) => {
    try {
      await seek(pos);
      fetchPlayback();
    } catch (e) {
      console.error("Failed to seek:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const handleVolumeClick = useCallback(async (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.round(pct * 100);
    try {
      await apiSetVolume(v);
      setVolume(v);
    } catch (e) {
      console.error("Failed to set volume:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleShuffle = useCallback(async () => {
    try {
      await apiSetShuffle(!shuffleRef.current);
      setShuffle(!shuffleRef.current);
      fetchPlayback();
    } catch (e) {
      console.error("Failed to set shuffle:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const handleMuteToggle = useCallback(async () => {
    const v = volumeRef.current > 0 ? 0 : 74;
    try {
      await apiSetVolume(v);
      setVolume(v);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  }, []);

  const handleRepeat = useCallback(async () => {
    const next = repeatRef.current === "off" ? "context" : repeatRef.current === "context" ? "track" : "off";
    try {
      await apiSetRepeat(next);
      setRepeat(next);
      fetchPlayback();
    } catch (e) {
      console.error("Failed to set repeat:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const playContextFn = useCallback(async (uri: string, offsetUri?: string) => {
    try {
      await playContext(uri, offsetUri);
      fetchPlayback();
    } catch (e) {
      console.error("Failed to play context:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  const playUrisFn = useCallback(async (uris: string[], offset?: number) => {
    try {
      await playUris(uris, offset);
      fetchPlayback();
    } catch (e) {
      console.error("Failed to play URIs:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchPlayback]);

  /* ── Keyboard Shortcuts ── */
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      /* Cmd+1/2/3/4 → sidebar nav */
      if (e.metaKey && /^Digit[1-4]$/.test(e.code)) {
        e.preventDefault();
        const idx = parseInt(e.code.replace("Digit", ""), 10) - 1;
        if (SIDEBAR_VIEWS[idx] && viewRef.current.type !== SIDEBAR_VIEWS[idx].view.type) {
          setHistory([SIDEBAR_VIEWS[idx].view]);
        }
        return;
      }

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          if (!trackRef.current) return;
          try {
            if (trackRef.current.isPlaying) {
              await pause();
            } else {
              await play();
            }
            fetchPlayback();
          } catch (ev) {
            console.error("Failed to play/pause:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          try {
            await next();
            fetchPlayback();
          } catch (ev) {
            console.error("Failed to skip next:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
        case "ArrowLeft": {
          if (e.altKey) {
            e.preventDefault();
            if (canGoBack) goBack();
          } else {
            e.preventDefault();
            try {
              await previous();
              fetchPlayback();
            } catch (ev) {
              console.error("Failed to skip previous:", ev);
              showError(ev instanceof Error ? ev.message : String(ev));
            }
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const v = Math.min(100, volumeRef.current + 5);
          try {
            await apiSetVolume(v);
            setVolume(v);
          } catch (ev) {
            console.error("Failed to set volume:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const v = Math.max(0, volumeRef.current - 5);
          try {
            await apiSetVolume(v);
            setVolume(v);
          } catch (ev) {
            console.error("Failed to set volume:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
        case "KeyS": {
          e.preventDefault();
          try {
            await apiSetShuffle(!shuffleRef.current);
            setShuffle(!shuffleRef.current);
            fetchPlayback();
          } catch (ev) {
            console.error("Failed to set shuffle:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
        case "KeyR": {
          e.preventDefault();
          const next = repeatRef.current === "off" ? "context" : repeatRef.current === "context" ? "track" : "off";
          try {
            await apiSetRepeat(next);
            setRepeat(next);
            fetchPlayback();
          } catch (ev) {
            console.error("Failed to set repeat:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
        case "KeyM": {
          e.preventDefault();
          const v = volumeRef.current > 0 ? 0 : 74;
          try {
            await apiSetVolume(v);
            setVolume(v);
          } catch (ev) {
            console.error("Failed to toggle mute:", ev);
            showError(ev instanceof Error ? ev.message : String(ev));
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canGoBack, fetchPlayback]);

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
    if (track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist,
        album: track.album,
        artwork: track.imageUrl ? [{ src: track.imageUrl, sizes: '512x512', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.playbackState = track.isPlaying ? 'playing' : 'paused';
    }
  }, [track, handlePlayPause, handlePrev, handleNext]);

  const navItems: { view: View; label: string; icon: () => preact.JSX.Element }[] = [
    { view: { type: "home" }, label: "Now Playing", icon: () => <IconHome active={view.type === "home"} /> },
    { view: { type: "search" }, label: "Search", icon: () => <IconSearch /> },
    { view: { type: "library", tab: "playlists" }, label: "Library", icon: () => <IconLibrary /> },
    { view: { type: "queue" }, label: "Queue", icon: () => <IconQueue /> },
  ];

  const handleNavClick = (itemView: View) => {
    if (view.type !== itemView.type) {
      setHistory([itemView]);
    }
  };

  const progressPct = track && track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;

  if ((!isAuthed || authError) && !isMockMode) {
    return (
      <div className="app-window" data-tauri-drag-region>
        <div className="auth-screen">
          <Logo size={48} />
          <h2 className="auth-title">SPX</h2>
          <p className="auth-subtitle">Spotify client</p>

          {/* Step-by-step instructions */}
          <div className="auth-instructions">
            <div className="auth-steps">
              <div className="auth-step">
                <span className="step-num">1</span>
                <span className="step-text">Click <strong>Connect Spotify</strong> below</span>
              </div>
              <div className="auth-step">
                <span className="step-num">2</span>
                <span className="step-text">Approve access in Spotify (click <strong>Agree</strong>)</span>
              </div>
              <div className="auth-step auth-step-highlight">
                <span className="step-num">3</span>
                <span className="step-text">Wait for the <strong>success page</strong> in your browser</span>
              </div>
              <div className="auth-step">
                <span className="step-num">4</span>
                <span className="step-text">Return here — authentication completes automatically</span>
              </div>
            </div>

            {/* Visual example */}
            <div className="auth-example">
              <p className="auth-example-label">The URL you need looks like this:</p>
              <code className="auth-example-code">http://127.0.0.1:1421/callback?code= A1B2C3... </code>
            </div>

            {/* Fallback instructions */}
            <div className="auth-fallback">
              <p>If the browser doesn't redirect automatically:</p>
              <ul className="auth-fallback-list">
                <li>Copy the URL from your browser's address bar</li>
                <li>Paste it in the field below</li>
              </ul>
            </div>
          </div>

          <button 
            className="btn-primary auth-btn" 
            onClick={handleStartAuth}
            disabled={isAuthLoading}
          >
            {isAuthLoading ? 'Connecting...' : 'Connect Spotify'}
          </button>

          <div className="auth-divider">or paste callback URL manually</div>
          <form className="callback-form" onSubmit={handleSubmitCallback}>
            <input
              type="text"
              className="callback-input"
              placeholder="http://127.0.0.1:1421/callback?code=..."
              value={callbackUrl}
              onInput={(e) => setCallbackUrl((e.target as HTMLInputElement).value)}
            />
            <button type="submit" className="btn-secondary">Submit</button>
          </form>
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
          liked={liked}
          onToggleLike={() => setLiked(!liked)}
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
    <div className="app-window" data-tauri-drag-region>
      <div aria-live="polite" className="sr-only">{error}</div>
      <div className="app-body">
        <nav className="sidebar">
          {navItems.map((item) => {
            const active = view.type === item.view.type;
            return (
              <button key={item.label} className={active ? "sidebar-btn active" : "sidebar-btn"} onClick={() => handleNavClick(item.view)} title={item.label} aria-label={item.label}>
                {item.icon()}
                <span>{item.label}</span>
              </button>
            );
          })}
          {history.length > 2 && (
            <div className="sidebar-breadcrumbs">
              <div className="sidebar-divider" />
              {history.slice(1, -1).map((h, i) => (
                <button
                  key={i}
                  className="sidebar-btn breadcrumb"
                  onClick={() => setHistory(history.slice(0, history.indexOf(h) + 1))}
                >
                  <span className="breadcrumb-label">{h.type === 'playlist' ? h.name : h.type === 'album' ? h.name : h.type === 'artist' ? h.name : h.type}</span>
                </button>
              ))}
            </div>
          )}
          <div className="sidebar-divider" />
          <div className="sidebar-footer">
            {user && (
              <div className="user-pill">
                {user.image ? (
                  <img src={user.image} alt="" />
                ) : (
                  <div className="user-pill-avatar">{user.name.charAt(0).toUpperCase()}</div>
                )}
                <span className="user-pill-name">{user.name}</span>
              </div>
            )}
          </div>
        </nav>

        <div className="main-area">
          <div className={"main-scroll" + (isMac ? " macos-main-scroll" : "")}>
            {renderScreen()}
          </div>
        </div>
      </div>

      <div className="player-bar">
        <div className="player-track">
          <div className="player-art">
            {track?.imageUrl ? <img src={track.imageUrl} alt="" /> : null}
          </div>
          <div className="player-meta">
            <div className="player-title">{track?.name || "No track"}</div>
            <div className="player-artist">{track?.artist || "—"}</div>
          </div>
          <button
            className={liked ? "player-like-btn liked" : "player-like-btn"}
            onClick={() => setLiked(!liked)}
            aria-label={liked ? "Remove from liked" : "Add to liked"}
            role="button"
            tabIndex={0}
          >
            <IconHeart filled={liked} />
          </button>
        </div>

        <div className="player-center">
          <div className="player-controls" role="group" aria-label="Playback controls">
            <button className="ctrl-btn" onClick={handleShuffle} title="Shuffle" aria-label="Shuffle" role="button" tabIndex={0}><IconShuffle active={shuffle} /></button>
            <button className="ctrl-btn" onClick={handlePrev} aria-label="Previous track" role="button" tabIndex={0}><IconPrev /></button>
            <button className="ctrl-btn play" onClick={handlePlayPause} aria-label={track?.isPlaying ? "Pause" : "Play"} role="button" tabIndex={0}>
              {track?.isPlaying ? <IconPause /> : <IconPlay />}
            </button>
            <button className="ctrl-btn" onClick={handleNext} aria-label="Next track" role="button" tabIndex={0}><IconNext /></button>
            <button className="ctrl-btn" onClick={handleRepeat} title="Repeat" aria-label={`Repeat: ${repeat}`} role="button" tabIndex={0}><IconRepeat mode={repeat} /></button>
          </div>
          <div className="scrubber">
            <span className="time current">{formatTime(track?.progressMs || 0)}</span>
            <div
              className="progress-track"
              ref={progressRef}
              onClick={handleSeek}
              role="slider"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress"
              tabIndex={0}
              style={{ "--progress-width": `${progressPct}%`, "--progress-left": `${progressPct}%` } as CSSProperties}
            >
              <div className="progress-fill" />
              <div className="progress-thumb" />
            </div>
            <span className="time total">{formatTime(track?.durationMs || 0)}</span>
          </div>
        </div>

        <div className="player-right">
          <DeviceSelector
            devices={availableDevices}
            activeDevice={activeDevice}
            onTransfer={handleTransferPlayback}
            onRefresh={loadDevices}
          />
          <button className="ctrl-btn" aria-label="Volume" role="button" tabIndex={0} onClick={handleMuteToggle}><IconVolume muted={volume === 0} /></button>
          <div
            className="volume-track"
            onClick={handleVolumeClick}
            role="slider"
            aria-valuenow={volume}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Volume"
            tabIndex={0}
            style={{ "--volume-width": `${volume}%` } as CSSProperties}
          >
            <div className="volume-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
