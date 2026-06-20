/**
 * Backend Proxy & Auth Flow Unit Tests
 *
 * Architecture:
 *   - tauriInvoke lives in ./tauri-invoke.ts → vi.mock('./tauri-invoke') gives full control.
 *   - scanLocalDevices imports tauriInvoke from ./tauri-invoke, so the mock intercepts it.
 *   - __is_spx_shim__ = false globally → isBrowserMode() = false in Vitest.
 *   - For scanLocalDevices error tests: tauriInvoke mock throws → scanLocalDevices catches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks BEFORE imports ───────────────────────────────────────────────────────

// Intercept tauriInvoke at the source module — scanLocalDevices calls it.
vi.mock('./tauri-invoke', () => ({
  tauriInvoke: vi.fn(),
  setSpxBackendUrl: vi.fn(),
}));

// Tauri shim (isBrowserMode() checks __is_spx_shim__)
vi.stubGlobal('__TAURI_INTERNALS__', { __is_spx_shim__: false });

// Tauri invoke (for when __is_spx_shim__ = true, used by startAuthFlow)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Storage mocks
let localStorageStore: Record<string, string> = {};
let sessionStorageStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { localStorageStore = {}; }),
});
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn((key: string) => sessionStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { sessionStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete sessionStorageStore[key]; }),
  clear: vi.fn(() => { sessionStorageStore = {}; }),
});

// Deterministic PKCE digest
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  }),
  subtle: {
    digest: vi.fn(async () =>
      new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)).buffer
    ),
  },
});

vi.stubGlobal('open', vi.fn().mockReturnValue(undefined));

// ─── Imports ────────────────────────────────────────────────────────────────────
import { tauriInvoke, setSpxBackendUrl } from './tauri-invoke';
import {
  startAuthFlow,
  scanLocalDevices,
  getAccessToken,
  logout,
} from './spotify';
import type { StoredToken } from './spotify';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'spx_spotify_token';

function makeToken(overrides: Partial<StoredToken> = {}): StoredToken {
  return {
    accessToken: 'BQTestAccessTokenXYZ',
    expiresAt: Date.now() + 3600_000,
    refreshToken: 'AQTestRefreshTokenXYZ',
    ...overrides,
  };
}

function setStoredToken(token: StoredToken) {
  localStorageStore[TOKEN_KEY] = JSON.stringify(token);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('tauriInvoke — direct control via vi.mock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tauriInvoke as ReturnType<typeof vi.fn>).mockReset();
    (setSpxBackendUrl as ReturnType<typeof vi.fn>).mockReset();
    sessionStorageStore = {};
    setSpxBackendUrl('');
  });

  it('passes cmd and args through', async () => {
    (tauriInvoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

    await tauriInvoke<{ ok: boolean }>('test_command', { foo: 'bar' });

    expect(tauriInvoke).toHaveBeenCalledWith('test_command', { foo: 'bar' });
  });

  it('setSpxBackendUrl is called with url string', () => {
    setSpxBackendUrl('http://127.0.0.1:1422');
    expect(setSpxBackendUrl).toHaveBeenCalledWith('http://127.0.0.1:1422');
  });

  it('setSpxBackendUrl clears url when empty string passed', () => {
    setSpxBackendUrl('');
    expect(setSpxBackendUrl).toHaveBeenCalledWith('');
  });
});

describe('scanLocalDevices — mDNS scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tauriInvoke as ReturnType<typeof vi.fn>).mockReset();
    (setSpxBackendUrl as ReturnType<typeof vi.fn>).mockReset();
    setSpxBackendUrl('');
  });

  it('returns device array on success', async () => {
    const devices = [
      { id: '1', name: 'Living Room', type: 'speaker' as const, ip: '192.168.1.11', port: 1234 },
    ];
    (tauriInvoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(devices);

    const result = await scanLocalDevices();

    expect(result).toEqual(devices);
    expect(tauriInvoke).toHaveBeenCalledWith('scan_spotify_devices');
  });

  it('returns empty array when tauriInvoke returns null', async () => {
    (tauriInvoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await scanLocalDevices();

    expect(result).toEqual([]);
  });

  it('returns empty array when response has no devices field', async () => {
    (tauriInvoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    const result = await scanLocalDevices();

    expect(result).toEqual([]);
  });

  it('returns empty array and logs warning on error', async () => {
    // Error logging only happens in browser mode (__is_spx_shim__ = true)
    (globalThis as any).__TAURI_INTERNALS__.__is_spx_shim__ = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue();

    const result = await scanLocalDevices();

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[scanLocalDevices]'),
      expect.any(Error)
    );

    warnSpy.mockRestore();
    fetchSpy.mockRestore();
    (globalThis as any).__TAURI_INTERNALS__.__is_spx_shim__ = false;
  });

  it('returns empty array when fetch returns non-ok', async () => {
    // Error logging only happens in browser mode (__is_spx_shim__ = true)
    (globalThis as any).__TAURI_INTERNALS__.__is_spx_shim__ = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server error', { status: 500 }));
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue();

    const result = await scanLocalDevices();

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[scanLocalDevices]'),
      expect.any(Error)
    );

    warnSpy.mockRestore();
    fetchSpy.mockRestore();
    (globalThis as any).__TAURI_INTERNALS__.__is_spx_shim__ = false;
  });

  it('calls tauriInvoke with scan_spotify_devices command', async () => {
    (tauriInvoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await scanLocalDevices();

    expect(tauriInvoke).toHaveBeenCalledWith('scan_spotify_devices');
  });

  it('uses setSpxBackendUrl with provided URL', async () => {
    setSpxBackendUrl('http://127.0.0.1:1422');

    expect(setSpxBackendUrl).toHaveBeenCalledWith('http://127.0.0.1:1422');
  });

  it('uses setSpxBackendUrl with empty string', async () => {
    setSpxBackendUrl('');

    expect(setSpxBackendUrl).toHaveBeenCalledWith('');
  });

  it('returns empty array when tauriInvoke resolves to undefined', async () => {
    (tauriInvoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const result = await scanLocalDevices();

    expect(result).toEqual([]);
  });
});

describe('Token storage and retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  it('getAccessToken returns token when not expired', () => {
    setStoredToken(makeToken({ expiresAt: Date.now() + 3600_000 }));
    expect(getAccessToken()).toBe('BQTestAccessTokenXYZ');
  });

  it('getAccessToken returns null when token is expired', () => {
    setStoredToken(makeToken({ expiresAt: Date.now() - 1000 }));
    expect(getAccessToken()).toBeNull();
  });

  it('getAccessToken returns null when token expires within 60s (treated as expired)', () => {
    setStoredToken(makeToken({ expiresAt: Date.now() + 30_000 }));
    expect(getAccessToken()).toBeNull();
  });

  it('getAccessToken returns null when no token stored', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('logout clears the stored token', () => {
    setStoredToken(makeToken());
    logout();
    expect(localStorage.removeItem).toHaveBeenCalledWith(TOKEN_KEY);
  });
});

describe('startAuthFlow — PKCE browser mode side effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tauriInvoke as ReturnType<typeof vi.fn>).mockReset();
    localStorageStore = {};
    sessionStorageStore = {};
    setSpxBackendUrl('');
    // Switch to browser redirect path
    (globalThis as any).__TAURI_INTERNALS__.__is_spx_shim__ = true;
    (globalThis as any).location = { href: '' };
  });

  afterEach(() => {
    (globalThis as any).__TAURI_INTERNALS__.__is_spx_shim__ = false;
  });

  it('saves pkce_verifier and oauth_state to sessionStorage', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await startAuthFlow();

    expect(sessionStorage.setItem).toHaveBeenCalledWith('pkce_verifier', expect.any(String));
    expect(sessionStorage.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String));
    fetchSpy.mockRestore();
  });

  it('pkce_verifier is 64 chars of URL-safe base64 (no padding)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await startAuthFlow();

    const verifier = sessionStorageStore['pkce_verifier'];
    expect(verifier).toBeDefined();
    expect(verifier!.length).toBe(64);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier).not.toContain('=');
    expect(verifier).not.toContain('+');
    expect(verifier).not.toContain('/');
  });

  it('oauth_state is 32 chars of URL-safe base64', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await startAuthFlow();

    const state = sessionStorageStore['oauth_state'];
    expect(state).toBeDefined();
    expect(state!.length).toBe(32);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('posts verifier and state to /save-verifier', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await startAuthFlow();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/save-verifier');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as any).headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = (init as any).body as URLSearchParams;
    expect(body.get('verifier')).toBeTruthy();
    expect(body.get('state')).toBeTruthy();
    fetchSpy.mockRestore();
  });

  it('does NOT throw if /save-verifier fails (error is swallowed)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(startAuthFlow()).resolves.not.toThrow();
  });

  it('sets window.location.href to Spotify authorize URL with PKCE params', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await startAuthFlow();

    const href = (globalThis as any).location.href;
    expect(href).toContain('https://accounts.spotify.com/authorize?');
    expect(href).toContain('response_type=code');
    expect(href).toContain('code_challenge_method=S256');
    expect(href).toContain('client_id=');
    expect(href).toContain('scope=');
  });

  it('verifier posted to /save-verifier matches sessionStorage', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await startAuthFlow();

    const verifier = sessionStorageStore['pkce_verifier'];
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = (init as any).body as URLSearchParams;
    expect(body.get('verifier')).toBe(verifier);
    expect(body.get('state')).toBe(sessionStorageStore['oauth_state']);
    fetchSpy.mockRestore();
  });
});
