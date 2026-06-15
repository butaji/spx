import { getAccessToken } from "./spotify";

// Spotify Web Playback SDK types
declare global {
  interface Window {
    Spotify: {
      Player: new (config: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  addListener: (event: string, callback: (data: any) => void) => void;
  removeListener: (event: string, callback: (data: any) => void) => void;
  getCurrentState: () => Promise<any | null>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
}

export let currentDeviceId: string | null = null;

export function getDeviceId(): string | null {
  return currentDeviceId;
}

const eventListeners = new Set<(event: { type: string; data?: any }) => void>();

export function onPlaybackEvent(callback: (event: { type: string; data?: any }) => void): () => void {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

function emit(type: string, data?: any) {
  eventListeners.forEach((cb) => cb({ type, data }));
}

let player: SpotifyPlayer | null = null;
let sdkLoadPromise: Promise<void> | null = null;
let reconnectTimer: number | null = null;

function loadSpotifySdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Spotify?.Player) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
    if (existing) {
      // Script is already loading; wait for the ready callback.
      const original = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        original?.();
        resolve();
      };
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK"));
    document.body.appendChild(script);

    // Failsafe timeout
    setTimeout(() => {
      if (!window.Spotify?.Player) {
        reject(new Error("Spotify Web Playback SDK load timed out"));
      }
    }, 15000);
  });

  return sdkLoadPromise;
}

export async function initPlayer(_token?: string): Promise<void> {
  // Don't init twice.
  if (player) {
    return;
  }

  try {
    await loadSpotifySdk();
  } catch (e) {
    console.error("[WebPlayback] Failed to load SDK:", e);
    return;
  }

  const token = _token || getAccessToken();
  if (!token) {
    console.warn("[WebPlayback] No access token available, skipping player init");
    return;
  }

  player = new window.Spotify.Player({
    name: "SPX Player",
    getOAuthToken: (cb) => cb(token),
    volume: 1.0,
  });

  player.addListener("ready", ({ device_id }: { device_id: string }) => {
    console.log("[WebPlayback] Ready with device ID:", device_id);
    currentDeviceId = device_id;
    emit("ready", { device_id });
  });

  player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
    console.log("[WebPlayback] Device went offline:", device_id);
    if (currentDeviceId === device_id) {
      currentDeviceId = null;
    }
    emit("not_ready", { device_id });
  });

  player.addListener("player_state_changed", (state) => {
    emit("state_changed", state);
  });

  player.addListener("initialization_error", ({ message }: { message: string }) => {
    console.error("[WebPlayback] Init error:", message);
    emit("error", { message });
  });

  player.addListener("authentication_error", ({ message }: { message: string }) => {
    console.error("[WebPlayback] Auth error:", message);
    emit("error", { message });
  });

  player.addListener("account_error", ({ message }: { message: string }) => {
    console.error("[WebPlayback] Account error:", message);
    emit("error", { message });
  });

  try {
    const connected = await player.connect();
    if (!connected) {
      console.warn("[WebPlayback] Player.connect() returned false");
    }
  } catch (e) {
    console.error("[WebPlayback] Failed to connect player:", e);
  }
}

export async function disconnectPlayer(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (player) {
    try {
      await player.disconnect();
    } catch (e) {
      console.warn("[WebPlayback] Disconnect error:", e);
    }
    player = null;
  }

  currentDeviceId = null;
  sdkLoadPromise = null;
}

export type PlaybackEventType = string;
export interface PlaybackEvent { type: PlaybackEventType; data?: any }
