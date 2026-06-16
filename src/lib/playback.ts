import { getAccessToken, isMockMode } from "./spotify";

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
let reconnectAttempt = 0;
let manuallyDisconnected = false;

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MOCK_DEVICE_ID = "spx-player";

// ─── Device readiness promise ────────────────────────────────────────────────

let deviceReadyResolve: ((id: string) => void) | null = null;
let deviceReadyPromise: Promise<string> | null = null;

function resetDeviceReady() {
  deviceReadyPromise = new Promise<string>((resolve) => {
    deviceReadyResolve = resolve;
  });
}

function resolveDeviceReady(deviceId: string) {
  currentDeviceId = deviceId;
  deviceReadyResolve?.(deviceId);
  deviceReadyResolve = null;
}

resetDeviceReady();

/**
 * Wait for the Web Playback SDK to report a device ID.
 * Resolves immediately if a device ID is already known.
 */
export async function waitForDeviceId(timeoutMs = 15000): Promise<string | null> {
  if (currentDeviceId) {
    return currentDeviceId;
  }

  // No player initialized and mock mode active — return mock id immediately.
  if (isMockMode()) {
    return MOCK_DEVICE_ID;
  }

  // No SDK loaded and no pending load — nothing to wait for.
  if (!sdkLoadPromise && !player) {
    return null;
  }

  const timeoutPromise = new Promise<null>((_, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for SPX Player device ID")), timeoutMs);
    // Ensure the timer doesn't keep pending promises alive in tests.
    if (typeof timer === "number" && "unref" in (timer as any)) {
      (timer as any).unref?.();
    }
  });

  try {
    const id = await Promise.race([deviceReadyPromise!, timeoutPromise]);
    return id;
  } catch (e) {
    console.warn("[WebPlayback] waitForDeviceId timed out");
    return null;
  }
}

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

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (manuallyDisconnected) return;
  if (reconnectTimer) return;
  if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
    console.warn("[WebPlayback] Max reconnect attempts reached");
    return;
  }

  const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
  reconnectAttempt++;
  console.log(`[WebPlayback] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`);

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    performReconnect();
  }, delay);
}

async function performReconnect() {
  if (manuallyDisconnected || player) return;

  console.log("[WebPlayback] Performing reconnect...");
  try {
    await initPlayer();
  } catch (e) {
    console.error("[WebPlayback] Reconnect failed:", e);
    scheduleReconnect();
  }
}

async function createAndConnectPlayer(token: string): Promise<void> {
  player = new window.Spotify.Player({
    name: "SPX Player",
    getOAuthToken: (cb) => cb(token),
    volume: 1.0,
  });

  player.addListener("ready", ({ device_id }: { device_id: string }) => {
    console.log("[WebPlayback] Ready with device ID:", device_id);
    reconnectAttempt = 0;
    resolveDeviceReady(device_id);
    emit("ready", { device_id });
  });

  player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
    console.log("[WebPlayback] Device went offline:", device_id);
    if (currentDeviceId === device_id) {
      currentDeviceId = null;
      resetDeviceReady();
    }
    emit("not_ready", { device_id });

    // The SDK connection dropped — tear down and reconnect.
    if (currentDeviceId === null && !manuallyDisconnected) {
      void disconnectInternal().then(() => scheduleReconnect());
    }
  });

  player.addListener("player_state_changed", (state) => {
    emit("state_changed", state);
  });

  player.addListener("initialization_error", ({ message }: { message: string }) => {
    console.error("[WebPlayback] Init error:", message);
    emit("error", { message });
    scheduleReconnect();
  });

  player.addListener("authentication_error", ({ message }: { message: string }) => {
    console.error("[WebPlayback] Auth error:", message);
    emit("error", { message });
    scheduleReconnect();
  });

  player.addListener("account_error", ({ message }: { message: string }) => {
    console.error("[WebPlayback] Account error:", message);
    emit("error", { message });
  });

  try {
    const connected = await player.connect();
    if (!connected) {
      console.warn("[WebPlayback] Player.connect() returned false");
      scheduleReconnect();
    }
  } catch (e) {
    console.error("[WebPlayback] Failed to connect player:", e);
    scheduleReconnect();
  }
}

export async function initPlayer(_token?: string): Promise<void> {
  // Don't init twice.
  if (player) {
    return;
  }

  manuallyDisconnected = false;

  // Mock mode: simulate an in-app player without loading the external SDK.
  if (isMockMode()) {
    console.log("[WebPlayback] Mock mode: using virtual SPX Player");
    resolveDeviceReady(MOCK_DEVICE_ID);
    emit("ready", { device_id: MOCK_DEVICE_ID });
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

  await createAndConnectPlayer(token);
}

async function disconnectInternal(): Promise<void> {
  clearReconnectTimer();
  if (player) {
    try {
      await player.disconnect();
    } catch (e) {
      console.warn("[WebPlayback] Disconnect error:", e);
    }
    player = null;
  }
  currentDeviceId = null;
  resetDeviceReady();
}

export async function disconnectPlayer(): Promise<void> {
  manuallyDisconnected = true;
  reconnectAttempt = 0;
  await disconnectInternal();
  sdkLoadPromise = null;
}

export type PlaybackEventType = string;
export interface PlaybackEvent { type: PlaybackEventType; data?: any }
