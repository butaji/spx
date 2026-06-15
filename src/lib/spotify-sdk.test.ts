/**
 * Spotify SDK Unit Tests
 * 
 * Tests PKCE auth flow, token management, and API wrappers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock Storage ────────────────────────────────────────────────────────────

let localStorageStore: Record<string, string> = {};
let sessionStorageStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { localStorageStore = {}; }),
});

vi.stubGlobal('sessionStorage', {
  getItem: vi.fn((key: string) => sessionStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => { sessionStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete sessionStorageStore[key]; }),
  clear: vi.fn(() => { sessionStorageStore = {}; }),
});

// ─── Mock crypto ─────────────────────────────────────────────────────────────

vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  }),
  subtle: {
    digest: vi.fn(async () => new ArrayBuffer(32)),
  },
});

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ─── Mock Tauri shell plugin ────────────────────────────────────────────────

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock Tauri API ─────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('test-client-id'),
}));

// ─── Import the module ───────────────────────────────────────────────────────

import * as SpotifySDK from './spotify-sdk';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Spotify SDK - Token Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  describe('isAuthenticated', () => {
    it('should return false when no token exists', () => {
      expect(SpotifySDK.isAuthenticated()).toBe(false);
    });

    it('should return true when valid token exists', () => {
      localStorageStore['spx_spotify_token'] = JSON.stringify({
        accessToken: 'test_token',
        expiresAt: Date.now() + 3600000,
      });
      expect(SpotifySDK.isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      localStorageStore['spx_spotify_token'] = JSON.stringify({
        accessToken: 'test_token',
        expiresAt: Date.now() - 1000,
      });
      expect(SpotifySDK.isAuthenticated()).toBe(false);
    });

    it('should return false when token expires within 1 minute', () => {
      localStorageStore['spx_spotify_token'] = JSON.stringify({
        accessToken: 'test_token',
        expiresAt: Date.now() + 30000, // 30 seconds
      });
      expect(SpotifySDK.isAuthenticated()).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear token from storage', () => {
      localStorageStore['spx_spotify_token'] = JSON.stringify({
        accessToken: 'test_token',
        expiresAt: Date.now() + 3600000,
      });

      SpotifySDK.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('spx_spotify_token');
    });
  });
});

describe('Spotify SDK - Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  describe('startAuthFlow', () => {
    it('should store PKCE verifier in sessionStorage', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get');
      locationSpy.mockReturnValue({ href: '' } as any);

      await SpotifySDK.startAuthFlow();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'pkce_verifier',
        expect.any(String)
      );
      expect(sessionStorageStore['pkce_verifier']).toBeDefined();

      locationSpy.mockRestore();
    });

    it('should open Spotify auth URL in browser', async () => {
      const { open } = await import('@tauri-apps/plugin-shell');
      
      await SpotifySDK.startAuthFlow();

      expect(open).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.spotify.com/authorize')
      );
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining('client_id=')
      );
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining('code_challenge_method=S256')
      );
    });
  });

  describe('handleAuthCallback', () => {
    it('should throw when PKCE verifier is missing', async () => {
      sessionStorageStore = {}; // No verifier

      await expect(SpotifySDK.handleAuthCallback('auth_code'))
        .rejects.toThrow('PKCE verifier not found');
    });

    it('should save token on successful auth', async () => {
      sessionStorageStore['pkce_verifier'] = 'test_verifier';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        }),
      });

      const result = await SpotifySDK.handleAuthCallback('auth_code');

      expect(result).toBe(true);
      expect(localStorageStore['spx_spotify_token']).toBeDefined();
    });

    it('should remove PKCE verifier after auth', async () => {
      sessionStorageStore['pkce_verifier'] = 'test_verifier';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        }),
      });

      await SpotifySDK.handleAuthCallback('auth_code');

      expect(sessionStorage.removeItem).toHaveBeenCalledWith('pkce_verifier');
    });

    it('should throw on invalid state (CSRF protection)', async () => {
      sessionStorageStore['oauth_state'] = 'expected_state';
      sessionStorageStore['pkce_verifier'] = 'test_verifier';

      await expect(SpotifySDK.handleAuthCallback('auth_code', 'wrong_state'))
        .rejects.toThrow('Invalid state parameter');
    });

    it('should validate state when provided', async () => {
      sessionStorageStore['oauth_state'] = 'correct_state';
      sessionStorageStore['pkce_verifier'] = 'test_verifier';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        }),
      });

      const result = await SpotifySDK.handleAuthCallback('auth_code', 'correct_state');

      expect(result).toBe(true);
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('oauth_state');
    });

    it('should skip state validation when no state stored', async () => {
      sessionStorageStore['pkce_verifier'] = 'test_verifier';
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        }),
      });

      // Should work without state when none stored
      const result = await SpotifySDK.handleAuthCallback('auth_code', 'any_state');
      expect(result).toBe(true);
    });
  });
});

describe('Spotify SDK - Token Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  it('should return false when no refresh token', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'expired_token',
      expiresAt: Date.now() - 1000,
    });

    const result = await SpotifySDK.refreshAccessToken();
    expect(result).toBe(false);
  });

  it('should return true and save new token on successful refresh', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Date.now() - 1000,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      }),
    });

    const result = await SpotifySDK.refreshAccessToken();

    expect(result).toBe(true);
    expect(localStorageStore['spx_spotify_token']).toBeDefined();
  });
});

describe('Spotify SDK - API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  it('should throw clear error when not authenticated', async () => {
    await expect(SpotifySDK.getPlaybackState())
      .rejects.toThrow('Not authenticated');
  });

  it('should throw when token is expired', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'expired_token',
      refreshToken: 'refresh_token',
      expiresAt: Date.now() - 1000,
    });

    // Should attempt refresh and fail
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    await expect(SpotifySDK.getPlaybackState())
      .rejects.toThrow();
  });
});

describe('Spotify SDK - PKCE Helpers', () => {
  it('should have generateRandomString-like behavior in startAuthFlow', async () => {
    const locationSpy = vi.spyOn(window, 'location', 'get');
    locationSpy.mockReturnValue({ href: '' } as any);

    sessionStorageStore = {};
    await SpotifySDK.startAuthFlow();

    // Verify verifier is 64 chars (from generateRandomString(64))
    expect(sessionStorageStore['pkce_verifier'].length).toBe(64);

    locationSpy.mockRestore();
  });
});


describe('Spotify SDK - addToQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  it('should throw when not authenticated', async () => {
    await expect(SpotifySDK.addToQueue('spotify:track:123'))
      .rejects.toThrow('Not authenticated');
  });

  it('should call fetch with correct URL', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'valid_token',
      refreshToken: 'refresh_token',
      expiresAt: Date.now() + 3600000,
    });

    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await SpotifySDK.addToQueue('spotify:track:123');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.spotify.com/v1/me/player/queue'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid_token',
        }),
      })
    );
  });

  it('should include device_id when provided', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'valid_token',
      refreshToken: 'refresh_token',
      expiresAt: Date.now() + 3600000,
    });

    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await SpotifySDK.addToQueue('spotify:track:123', 'device_abc');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('device_id=device_abc'),
      expect.any(Object)
    );
  });
});

describe('Spotify SDK - getAudioAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
    sessionStorageStore = {};
  });

  it('should throw when not authenticated', async () => {
    await expect(SpotifySDK.getAudioAnalysis('track123'))
      .rejects.toThrow('Not authenticated');
  });

  it('should call fetch with correct URL', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'valid_token',
      refreshToken: 'refresh_token',
      expiresAt: Date.now() + 3600000,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ segments: [] }),
    } as Response);

    await SpotifySDK.getAudioAnalysis('track123');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/audio-analysis/track123'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid_token',
        }),
      })
    );
  });
});
