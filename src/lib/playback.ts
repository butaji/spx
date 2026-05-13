declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// Types
export interface SpotifyDevice {
  device_id: string;
}

export interface SpotifyPlayerState {
  context: {
    uri: string | null;
    metadata: any;
  };
  disallows: {
    pausing?: boolean;
    playing?: boolean;
    skipping_next?: boolean;
    skipping_prev?: boolean;
    toggling_shuffle?: boolean;
    toggling_repeat_context?: boolean;
    toggling_repeat_track?: boolean;
    seeking?: boolean;
  };
  paused: boolean;
  position: number;
  repeat_mode: 0 | 1 | 2;
  shuffle_active: boolean;
  track: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artist: {
      name: string;
      uri: string;
    };
    album: {
      name: string;
      uri: string;
      images: Array<{ url: string; width: number; height: number }>;
    };
  };
}

export type PlaybackEventType =
  | 'ready'
  | 'not_ready'
  | 'player_state_changed'
  | 'initialization_error'
  | 'authentication_error'
  | 'account_error'
  | 'autoplay_failed'
  | 'system_error'
  | 'device_not_registered';

export interface PlaybackEvent {
  type: PlaybackEventType;
  data?: any;
}

export interface PlaybackSignal {
  isPlaying: boolean;
  currentTrack: SpotifyPlayerState['track'] | null;
  position: number;
  duration: number;
  positionMs: number;
  durationMs: number;
}

type EventCallback = (event: PlaybackEvent) => void;
type SignalCallback = (signal: PlaybackSignal) => void;

// Import for device polling
import { getAvailableDevices } from './spotify';

// Global state
let player: any = null;
let deviceId: string | null = null;
export let currentDeviceId: string | null = null;
let currentState: PlaybackSignal = {
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  positionMs: 0,
  durationMs: 0,
};

const eventListeners = new Set<EventCallback>();
const signalListeners = new Set<SignalCallback>();

/**
 * Load the Spotify Web Playback SDK script dynamically
 */
export function loadSpotifySDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }

    // Set up the callback before loading the script
    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onload = () => {
      // If Spotify is already available, resolve immediately
      if (window.Spotify) {
        resolve();
      }
      // Otherwise, window.onSpotifyWebPlaybackSDKReady will handle it
    };
    script.onerror = () => {
      reject(new Error('Failed to load Spotify SDK'));
    };

    document.body.appendChild(script);
  });
}

/**
 * Initialize the Spotify player with an access token
 */
export async function initPlayer(token: string): Promise<any> {
  console.log("[Play Debug] Web Playback SDK loaded, initializing player...");
  await loadSpotifySDK();

  if (!window.Spotify) {
    throw new Error('Spotify SDK not loaded');
  }

  player = new window.Spotify.Player({
    name: 'SPX Player',
    getOAuthToken: (cb: (token: string) => void) => cb(token),
    volume: 0.5,
  });

  // Not ready event
  player.addListener('not_ready', ({ device_id }: SpotifyDevice) => {
    console.log('Device ID has gone offline:', device_id);
    deviceId = null;
    currentDeviceId = null;
    emitEvent('not_ready', { device_id });
  });

  // Player state changed event
  player.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
    if (state) {
      currentState = {
        isPlaying: !state.paused,
        currentTrack: state.track,
        position: state.position / 1000,
        duration: (state.track?.duration_ms ?? 0) / 1000,
        positionMs: state.position,
        durationMs: state.track?.duration_ms ?? 0,
      };
      emitSignal(currentState);
    } else {
      currentState = {
        isPlaying: false,
        currentTrack: null,
        position: 0,
        duration: 0,
        positionMs: 0,
        durationMs: 0,
      };
      emitSignal(currentState);
    }
    emitEvent('player_state_changed', state);
  });

  // Error events
  player.addListener('initialization_error', ({ message }: { message: string }) => {
    console.warn('SDK init note:', message);
    emitEvent('initialization_error', { message });
  });

  player.addListener('authentication_error', ({ message }: { message: string }) => {
    console.warn('SDK auth note:', message);

    // Don't auto-clear token - just emit the event and let UI handle it
    // User can still use other Spotify Connect devices
    emitEvent('authentication_error', { message });
  });

  player.addListener('account_error', ({ message }: { message: string }) => {
    console.warn('SDK account note:', message);
    emitEvent('account_error', { message });
  });

  player.addListener('autoplay_failed', () => {
    console.error('Autoplay failed');
    emitEvent('autoplay_failed', null);
  });

  // Ready event with device API polling
  player.addListener('ready', async ({ device_id }: SpotifyDevice) => {
    console.log("[Play Debug] SDK ready event, device ID:", device_id);
    deviceId = device_id;
    currentDeviceId = device_id;

    // Wait 2s for device to register with Spotify servers
    await new Promise(r => setTimeout(r, 2000));

    // Poll until device appears in API (60 attempts × 500ms = 30s)
    let found = false;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const devices = await getAvailableDevices();
        if (devices.devices?.some((d: any) => d.id === device_id)) {
          console.log('[Play Debug] Device confirmed in API');
          found = true;
          break;
        }
      } catch (e) {
        // Ignore polling errors, keep trying
      }
    }

    if (!found) {
      console.warn('[Play Debug] Device not found in API after 30s');
      console.warn('[Playback] SPX Player not visible in API. You can still use other Spotify devices.');
      emitEvent('device_not_registered', {
        message: 'SPX Player not registered. Use another device for playback.'
      });
    }

    emitEvent('ready', { device_id });
  });

  // Connect with retry logic
  let connectAttempts = 0;
  const maxAttempts = 2;

  async function tryConnect(): Promise<boolean> {
    connectAttempts++;
    console.log(`[Play Debug] Connection attempt ${connectAttempts}/${maxAttempts}`);

    const success = await player.connect();
    if (!success) {
      console.warn('[Play Debug] player.connect() returned false');
      if (connectAttempts < maxAttempts) {
        console.log('[Play Debug] Retrying in 2s...');
        await new Promise(r => setTimeout(r, 2000));
        return tryConnect();
      }
      return false;
    }
    return true;
  }

  const connected = await tryConnect();
  if (!connected) {
    throw new Error('Failed to connect to Spotify player after retries');
  }

  return player;
}

/**
 * Disconnect the player
 */
export async function disconnectPlayer(): Promise<void> {
  if (player) {
    await player.disconnect();
    player = null;
    deviceId = null;
    currentDeviceId = null;
    currentState = {
      isPlaying: false,
      currentTrack: null,
      position: 0,
      duration: 0,
      positionMs: 0,
      durationMs: 0,
    };
    emitSignal(currentState);
  }
}

/**
 * Toggle play/pause
 */
export async function togglePlay(): Promise<boolean> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  const state = await player.getCurrentState();
  if (state && !state.paused) {
    await player.pause();
    return false;
  } else {
    await player.resume();
    return true;
  }
}

/**
 * Pause playback
 */
export async function pause(): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  await player.pause();
}

/**
 * Resume playback
 */
export async function resume(): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  await player.resume();
}

/**
 * Skip to next track
 */
export async function skipNext(): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  await player.nextTrack();
}

/**
 * Skip to previous track
 */
export async function skipPrevious(): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  await player.previousTrack();
}

/**
 * Seek to a position in the track
 * @param positionMs Position in milliseconds
 */
export async function seek(positionMs: number): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  await player.seek(positionMs);
}

/**
 * Set volume
 * @param volume Volume level from 0 to 1
 */
export async function setVolume(volume: number): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  const clampedVolume = Math.max(0, Math.min(1, volume));
  await player.setVolume(clampedVolume);
}

/**
 * Get the current playback state
 */
export async function getCurrentState(): Promise<PlaybackSignal> {
  if (!player) {
    throw new Error('Player not initialized');
  }
  const state = await player.getCurrentState();
  if (state) {
    currentState = {
      isPlaying: !state.paused,
      currentTrack: state.track,
      position: state.position / 1000,
      duration: (state.track?.duration_ms ?? 0) / 1000,
      positionMs: state.position,
      durationMs: state.track?.duration_ms ?? 0,
    };
  }
  return currentState;
}

/**
 * Get the device ID
 */
export function getDeviceId(): string | null {
  return deviceId;
}

/**
 * Get the player instance
 */
export function getPlayer(): any {
  return player;
}

// Event subscription

/**
 * Subscribe to playback events
 * @param callback Function to call when an event occurs
 * @returns Unsubscribe function
 */
export function onPlaybackEvent(callback: EventCallback): () => void {
  eventListeners.add(callback);
  return () => eventListeners.delete(callback);
}

/**
 * Subscribe to playback signal changes (detailed state)
 * @param callback Function to call when the signal changes
 * @returns Unsubscribe function
 */
export function onPlaybackSignal(callback: SignalCallback): () => void {
  signalListeners.add(callback);
  return () => signalListeners.delete(callback);
}

// Internal emit functions

function emitEvent(type: PlaybackEventType, data: any): void {
  const event: PlaybackEvent = { type, data };
  eventListeners.forEach((listener) => listener(event));
}

function emitSignal(signal: PlaybackSignal): void {
  signalListeners.forEach((listener) => listener(signal));
}

// Export event types for type guards
export const PlaybackEventTypes: Record<PlaybackEventType, PlaybackEventType> = {
  ready: 'ready',
  not_ready: 'not_ready',
  player_state_changed: 'player_state_changed',
  initialization_error: 'initialization_error',
  authentication_error: 'authentication_error',
  account_error: 'account_error',
  autoplay_failed: 'autoplay_failed',
  system_error: 'system_error',
  device_not_registered: 'device_not_registered',
};
