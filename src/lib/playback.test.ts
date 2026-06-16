import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock dependencies before importing playback module ───────────────────────

vi.mock('./spotify', () => ({
  getAccessToken: vi.fn(),
  isMockMode: vi.fn(() => false),
}));

import { getAccessToken, isMockMode } from './spotify';

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface MockPlayer {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  getCurrentState: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  togglePlay: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  previousTrack: ReturnType<typeof vi.fn>;
  nextTrack: ReturnType<typeof vi.fn>;
  _listeners: Record<string, ((data: any) => void)[]>;
  _emit: (event: string, data?: any) => void;
  _config?: any;
}

let latestMockPlayer: MockPlayer | null = null;
let nextConnectResult: any = true;
let nextConnectError: Error | null = null;

function createMockPlayer(): MockPlayer {
  const listeners: Record<string, ((data: any) => void)[]> = {};
  latestMockPlayer = {
    connect: vi.fn().mockImplementation(() => {
      if (nextConnectError) {
        const err = nextConnectError;
        nextConnectError = null;
        return Promise.reject(err);
      }
      const result = nextConnectResult;
      nextConnectResult = true;
      return Promise.resolve(result);
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn((event: string, cb: (data: any) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    removeListener: vi.fn(),
    getCurrentState: vi.fn().mockResolvedValue(null),
    setVolume: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    togglePlay: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    previousTrack: vi.fn().mockResolvedValue(undefined),
    nextTrack: vi.fn().mockResolvedValue(undefined),
    _listeners: listeners,
    _emit: (event: string, data?: any) => listeners[event]?.forEach((cb) => cb(data)),
  };
  return latestMockPlayer;
}

function createMockPlayerClass() {
  const Player = vi.fn().mockImplementation(function (this: any, config: any) {
    const player = createMockPlayer();
    player._config = config;
    return player;
  });
  return { Player };
}

function setupSpotifySdk() {
  const { Player } = createMockPlayerClass();
  (window as any).Spotify = { Player };
  return { Player };
}

function clearSpotifySdk() {
  delete (window as any).Spotify;
  delete (window as any).onSpotifyWebPlaybackSDKReady;
}

// ─── DOM interception for Spotify SDK script loading ───────────────────────────

let injectedScripts: any[] = [];
let originalCreateElement: typeof document.createElement;
let originalQuerySelector: typeof document.querySelector;
let originalAppendChild: typeof document.body.appendChild;

function installDomIntercepts() {
  injectedScripts = [];

  originalCreateElement = document.createElement.bind(document);
  originalQuerySelector = document.querySelector.bind(document);
  originalAppendChild = document.body.appendChild.bind(document.body);

  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: any) => {
    if (tagName.toLowerCase() === 'script') {
      const fake: any = {
        src: '',
        async: false,
        onerror: null,
        onload: null,
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
      };
      return fake;
    }
    return originalCreateElement(tagName, options);
  });

  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
    if (selector === 'script[src="https://sdk.scdn.co/spotify-player.js"]') {
      return injectedScripts.find((s) => s.src === 'https://sdk.scdn.co/spotify-player.js') || null;
    }
    return originalQuerySelector(selector);
  });

  vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
    if ((node as any).src === 'https://sdk.scdn.co/spotify-player.js') {
      injectedScripts.push(node);
      return node;
    }
    return originalAppendChild(node);
  });
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });

  latestMockPlayer = null;
  nextConnectResult = true;
  nextConnectError = null;
  clearSpotifySdk();
  document.body.innerHTML = '';
  installDomIntercepts();
  (isMockMode as ReturnType<typeof vi.fn>).mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1: getDeviceId
// ═══════════════════════════════════════════════════════════════════════════════

describe('getDeviceId', () => {
  it('returns null before the player is ready', async () => {
    const { getDeviceId } = await import('./playback');
    expect(getDeviceId()).toBeNull();
  });

  it('returns the device id after the ready event fires', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, getDeviceId, onPlaybackEvent } = await import('./playback');
    const readyHandler = vi.fn();
    onPlaybackEvent(readyHandler);

    await initPlayer();
    latestMockPlayer!._emit('ready', { device_id: 'device-123' });

    expect(getDeviceId()).toBe('device-123');
    expect(readyHandler).toHaveBeenCalledWith({ type: 'ready', data: { device_id: 'device-123' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2: onPlaybackEvent subscription
// ═══════════════════════════════════════════════════════════════════════════════

describe('onPlaybackEvent', () => {
  it('notifies all subscribers and allows unsubscribing', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, onPlaybackEvent } = await import('./playback');
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsubscribe1 = onPlaybackEvent(handler1);
    onPlaybackEvent(handler2);

    await initPlayer();

    latestMockPlayer!._emit('player_state_changed', { paused: true });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    unsubscribe1();
    latestMockPlayer!._emit('player_state_changed', { paused: false });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3: initPlayer happy paths
// ═══════════════════════════════════════════════════════════════════════════════

describe('initPlayer — happy paths', () => {
  it('creates a player with the provided token', async () => {
    const { Player } = setupSpotifySdk();

    const { initPlayer } = await import('./playback');
    await initPlayer('custom-token');

    expect(Player).toHaveBeenCalledTimes(1);
    expect(latestMockPlayer!._config).toMatchObject({
      name: 'SPX Player',
      volume: 1.0,
    });

    // Verify the OAuth token callback resolves to the provided token
    const tokenCb = vi.fn();
    latestMockPlayer!._config.getOAuthToken(tokenCb);
    expect(tokenCb).toHaveBeenCalledWith('custom-token');
  });

  it('falls back to getAccessToken when no token is provided', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('stored-token');

    const { initPlayer } = await import('./playback');
    await initPlayer();

    const tokenCb = vi.fn();
    latestMockPlayer!._config.getOAuthToken(tokenCb);
    expect(tokenCb).toHaveBeenCalledWith('stored-token');
  });

  it('does not initialize the player twice', async () => {
    const { Player } = setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer } = await import('./playback');
    await initPlayer();
    await initPlayer();
    await initPlayer();

    expect(Player).toHaveBeenCalledTimes(1);
  });

  it('connects the player after initialization', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer } = await import('./playback');
    await initPlayer();

    expect(latestMockPlayer!.connect).toHaveBeenCalledTimes(1);
  });

  it('loads the SDK script when window.Spotify is not present', async () => {
    const { Player } = setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    // Make sure Spotify is not present at import time; setupSpotifySdk sets it,
    // so we clear it and only restore it when the callback fires.
    clearSpotifySdk();

    const { initPlayer } = await import('./playback');
    const initPromise = initPlayer();

    // Script should have been injected
    expect(injectedScripts).toHaveLength(1);
    const script = injectedScripts[0];
    expect(script.src).toBe('https://sdk.scdn.co/spotify-player.js');
    expect(script.async).toBe(true);

    // Simulate SDK load
    (window as any).Spotify = { Player };
    (window as any).onSpotifyWebPlaybackSDKReady();

    await initPromise;
    expect(Player).toHaveBeenCalledTimes(1);
  });

  it('waits for an already-loading SDK script instead of injecting a second one', async () => {
    const { Player } = setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    clearSpotifySdk();

    // Inject the script manually to simulate a previous initPlayer call
    const preExistingScript = {
      src: 'https://sdk.scdn.co/spotify-player.js',
      async: true,
      onerror: null,
      onload: null,
    };
    injectedScripts.push(preExistingScript);

    const { initPlayer } = await import('./playback');
    const initPromise = initPlayer();

    // No new script should be injected
    expect(injectedScripts).toHaveLength(1);

    (window as any).Spotify = { Player };
    (window as any).onSpotifyWebPlaybackSDKReady();

    await initPromise;
    expect(Player).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4: initPlayer error handling
// ═══════════════════════════════════════════════════════════════════════════════

describe('initPlayer — error handling', () => {
  it('returns early when no access token is available', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { initPlayer } = await import('./playback');
    await initPlayer();

    expect(injectedScripts).toHaveLength(0);
    expect((window as any).Spotify.Player).not.toHaveBeenCalled();
  });

  it('handles SDK load script error gracefully', async () => {
    clearSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initPlayer } = await import('./playback');
    const initPromise = initPlayer();

    const script = injectedScripts[0];
    script.onerror?.(new Event('error'));

    await initPromise;

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[WebPlayback] Failed to load SDK:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('handles SDK load timeout gracefully', async () => {
    clearSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initPlayer } = await import('./playback');
    const initPromise = initPlayer();

    await vi.advanceTimersByTimeAsync(15_000);
    await initPromise;

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[WebPlayback] Failed to load SDK:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('logs a warning when connect returns false', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { initPlayer } = await import('./playback');
    nextConnectResult = false;

    await initPlayer();

    expect(consoleWarnSpy).toHaveBeenCalledWith('[WebPlayback] Player.connect() returned false');
    consoleWarnSpy.mockRestore();
  });

  it('logs an error when connect throws', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initPlayer } = await import('./playback');
    nextConnectError = new Error('connect refused');

    await initPlayer();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[WebPlayback] Failed to connect player:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5: Player event listeners
// ═══════════════════════════════════════════════════════════════════════════════

describe('initPlayer — player event listeners', () => {
  beforeEach(() => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');
  });

  it('registers all required listeners', async () => {
    const { initPlayer } = await import('./playback');
    await initPlayer();

    const events = latestMockPlayer!.addListener.mock.calls.map((call: any[]) => call[0] as string);

    expect(events).toEqual([
      'ready',
      'not_ready',
      'player_state_changed',
      'initialization_error',
      'authentication_error',
      'account_error',
    ]);
  });

  it('clears currentDeviceId when the not_ready event fires for the current device', async () => {
    const { initPlayer, getDeviceId, onPlaybackEvent } = await import('./playback');
    const handler = vi.fn();
    onPlaybackEvent(handler);

    await initPlayer();

    latestMockPlayer!._emit('ready', { device_id: 'device-123' });
    expect(getDeviceId()).toBe('device-123');

    latestMockPlayer!._emit('not_ready', { device_id: 'device-123' });
    expect(getDeviceId()).toBeNull();
    expect(handler).toHaveBeenLastCalledWith({ type: 'not_ready', data: { device_id: 'device-123' } });
  });

  it('ignores not_ready events for other devices', async () => {
    const { initPlayer, getDeviceId } = await import('./playback');

    await initPlayer();

    latestMockPlayer!._emit('ready', { device_id: 'device-123' });
    latestMockPlayer!._emit('not_ready', { device_id: 'device-999' });

    expect(getDeviceId()).toBe('device-123');
  });

  it('emits player_state_changed events', async () => {
    const { initPlayer, onPlaybackEvent } = await import('./playback');
    const handler = vi.fn();
    onPlaybackEvent(handler);

    await initPlayer();

    const state = { paused: false, track_window: { current_track: { name: 'Song' } } };
    latestMockPlayer!._emit('player_state_changed', state);

    expect(handler).toHaveBeenCalledWith({ type: 'state_changed', data: state });
  });

  it('emits error events for initialization, authentication, and account errors', async () => {
    const { initPlayer, onPlaybackEvent } = await import('./playback');
    const handler = vi.fn();
    onPlaybackEvent(handler);

    await initPlayer();

    latestMockPlayer!._emit('initialization_error', { message: 'init failed' });
    expect(handler).toHaveBeenCalledWith({ type: 'error', data: { message: 'init failed' } });

    latestMockPlayer!._emit('authentication_error', { message: 'auth failed' });
    expect(handler).toHaveBeenLastCalledWith({ type: 'error', data: { message: 'auth failed' } });

    latestMockPlayer!._emit('account_error', { message: 'account issue' });
    expect(handler).toHaveBeenLastCalledWith({ type: 'error', data: { message: 'account issue' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 6: disconnectPlayer
// ═══════════════════════════════════════════════════════════════════════════════

describe('disconnectPlayer', () => {
  it('disconnects the player and resets state', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, disconnectPlayer, getDeviceId } = await import('./playback');
    await initPlayer();
    latestMockPlayer!._emit('ready', { device_id: 'device-123' });

    expect(getDeviceId()).toBe('device-123');

    await disconnectPlayer();

    expect(latestMockPlayer!.disconnect).toHaveBeenCalledTimes(1);
    expect(getDeviceId()).toBeNull();
  });

  it('allows re-initialization after disconnect', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, disconnectPlayer } = await import('./playback');
    await initPlayer();
    await disconnectPlayer();
    await initPlayer();

    expect((window as any).Spotify.Player).toHaveBeenCalledTimes(2);
  });

  it('handles disconnect errors gracefully', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { initPlayer, disconnectPlayer } = await import('./playback');
    await initPlayer();
    latestMockPlayer!.disconnect.mockRejectedValue(new Error('disconnect failed'));

    await disconnectPlayer();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[WebPlayback] Disconnect error:',
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('is safe to call when player was never initialized', async () => {
    const { disconnectPlayer, getDeviceId } = await import('./playback');
    await expect(disconnectPlayer()).resolves.toBeUndefined();
    expect(getDeviceId()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 7: SDK load promise caching
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadSpotifySdk — caching', () => {
  it('reuses the same SDK load promise and player instance across calls', async () => {
    clearSpotifySdk();
    const { Player } = createMockPlayerClass();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer } = await import('./playback');

    const p1 = initPlayer();

    // Only one script should be injected
    expect(injectedScripts).toHaveLength(1);

    (window as any).Spotify = { Player };
    (window as any).onSpotifyWebPlaybackSDKReady();

    await p1;

    // Subsequent calls should reuse the existing player
    await initPlayer();
    await initPlayer();

    expect(Player).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 8: waitForDeviceId
// ═══════════════════════════════════════════════════════════════════════════════

describe('waitForDeviceId', () => {
  it('returns the current device id immediately when ready', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, waitForDeviceId } = await import('./playback');
    await initPlayer();
    latestMockPlayer!._emit('ready', { device_id: 'device-123' });

    const id = await waitForDeviceId();
    expect(id).toBe('device-123');
  });

  it('resolves once the ready event fires', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, waitForDeviceId } = await import('./playback');
    await initPlayer();

    const waitPromise = waitForDeviceId(5000);
    latestMockPlayer!._emit('ready', { device_id: 'device-456' });
    expect(await waitPromise).toBe('device-456');
  });

  it('returns null when the device id does not arrive in time', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, waitForDeviceId } = await import('./playback');
    await initPlayer();

    const id = await waitForDeviceId(50);
    expect(id).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 9: mock mode
// ═══════════════════════════════════════════════════════════════════════════════

describe('initPlayer — mock mode', () => {
  it('sets the mock SPX Player device id without loading the SDK', async () => {
    clearSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');
    (isMockMode as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const { initPlayer, getDeviceId, onPlaybackEvent } = await import('./playback');
    const handler = vi.fn();
    onPlaybackEvent(handler);

    await initPlayer();

    expect(injectedScripts).toHaveLength(0);
    expect(getDeviceId()).toBe('spx-player');
    expect(handler).toHaveBeenCalledWith({ type: 'ready', data: { device_id: 'spx-player' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 10: reconnect after not_ready
// ═══════════════════════════════════════════════════════════════════════════════

describe('initPlayer — reconnect', () => {
  it('schedules a reconnect when the current device goes not_ready', async () => {
    setupSpotifySdk();
    (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');

    const { initPlayer, getDeviceId } = await import('./playback');
    await initPlayer();

    latestMockPlayer!._emit('ready', { device_id: 'device-123' });
    expect(getDeviceId()).toBe('device-123');

    latestMockPlayer!._emit('not_ready', { device_id: 'device-123' });
    expect(getDeviceId()).toBeNull();

    // A new player should be created after the reconnect delay.
    await vi.advanceTimersByTimeAsync(1500);
    expect((window as any).Spotify.Player).toHaveBeenCalledTimes(2);
  });
});
