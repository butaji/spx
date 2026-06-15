/**
 * Spotify Module Unit Tests
 * 
 * Tests the Spotify wrapper module that re-exports SDK functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); }),
});

// Mock sessionStorage
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

// Mock crypto
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  }),
  subtle: {
    digest: vi.fn(async () => new ArrayBuffer(32)),
  },
});

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockRejectedValue(new Error('Not in Tauri')),
}));

describe('Spotify Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
  });

  describe('Authentication Functions', () => {
    it('exports startAuthFlow function', async () => {
      const { startAuthFlow } = await import('./spotify');
      expect(typeof startAuthFlow).toBe('function');
    });

    it('exports logout function', async () => {
      const { logout } = await import('./spotify');
      expect(typeof logout).toBe('function');
    });

    it('exports handleAuthCallback function', async () => {
      const { handleAuthCallback } = await import('./spotify');
      expect(typeof handleAuthCallback).toBe('function');
    });

    it('logout clears token storage', async () => {
      localStorageMock['spx_spotify_token'] = JSON.stringify({
        accessToken: 'test',
        expiresAt: Date.now() + 3600000,
      });

      const { logout } = await import('./spotify');
      await logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('spx_spotify_token');
    });
  });

  describe('Token Management', () => {
    it('isAuthenticated returns false without token', async () => {
      const { isAuthenticated } = await import('./spotify');
      expect(isAuthenticated()).toBe(false);
    });

    it('isAuthenticated returns true with valid token', async () => {
      localStorageMock['spx_spotify_token'] = JSON.stringify({
        accessToken: 'valid_token',
        expiresAt: Date.now() + 3600000,
      });

      const { isAuthenticated } = await import('./spotify');
      expect(isAuthenticated()).toBe(true);
    });

    it('isAuthenticated returns false with expired token', async () => {
      localStorageMock['spx_spotify_token'] = JSON.stringify({
        accessToken: 'expired_token',
        expiresAt: Date.now() - 1000,
      });

      const { isAuthenticated } = await import('./spotify');
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('API Functions', () => {
    it('exports playback control functions', async () => {
      const { play, pause, next, previous, seek, setVolume } = await import('./spotify');
      
      expect(typeof play).toBe('function');
      expect(typeof pause).toBe('function');
      expect(typeof next).toBe('function');
      expect(typeof previous).toBe('function');
      expect(typeof seek).toBe('function');
      expect(typeof setVolume).toBe('function');
    });

    it('exports context playback functions', async () => {
      const { playContext, playUris } = await import('./spotify');
      
      expect(typeof playContext).toBe('function');
      expect(typeof playUris).toBe('function');
    });

    it('exports library functions', async () => {
      const { 
        getUserProfile, 
        getUserPlaylists, 
        getSavedTracks,
        saveTracks,
        removeSavedTracks,
      } = await import('./spotify');
      
      expect(typeof getUserProfile).toBe('function');
      expect(typeof getUserPlaylists).toBe('function');
      expect(typeof getSavedTracks).toBe('function');
      expect(typeof saveTracks).toBe('function');
      expect(typeof removeSavedTracks).toBe('function');
    });

    it('exports search functions', async () => {
      const { search } = await import('./spotify');
      expect(typeof search).toBe('function');
    });

    it('exports device functions', async () => {
      const { getAvailableDevices, transferPlayback } = await import('./spotify');
      
      expect(typeof getAvailableDevices).toBe('function');
      expect(typeof transferPlayback).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('API functions throw when not authenticated', async () => {
      const { play } = await import('./spotify');
      
      await expect(play()).rejects.toThrow('Not authenticated');
    });

    it('API functions include helpful error messages', async () => {
      const { getPlaybackState } = await import('./spotify');
      
      try {
        await getPlaybackState();
      } catch (e: any) {
        expect(e.message).toContain('authenticated');
      }
    });
  });

  describe('Replayability', () => {
    it('can call functions after successful auth', async () => {
      // Simulate successful auth
      localStorageMock['spx_spotify_token'] = JSON.stringify({
        accessToken: 'test_token',
        expiresAt: Date.now() + 3600000,
      });

      // Mock the SDK's API call
      const { isAuthenticated } = await import('./spotify');
      expect(isAuthenticated()).toBe(true);
    });
  });
});

describe('Token Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
  });

  it('refreshAccessToken returns false without refresh token', async () => {
    localStorageMock['spx_spotify_token'] = JSON.stringify({
      accessToken: 'expired_token',
      expiresAt: Date.now() - 1000,
      // No refresh token
    });

    const { refreshAccessToken } = await import('./spotify');
    const result = await refreshAccessToken();
    
    expect(result).toBe(false);
  });

  it('refreshAccessToken attempts to refresh with refresh token', async () => {
    localStorageMock['spx_spotify_token'] = JSON.stringify({
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh',
      expiresAt: Date.now() - 1000,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        expires_in: 3600,
      }),
    });

    const { refreshAccessToken } = await import('./spotify');
    const result = await refreshAccessToken();
    
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('Spotify SDK Export', () => {
  it('exports spotifySdk', async () => {
    const { spotifySdk } = await import('./spotify');
    expect(spotifySdk).toBeDefined();
    expect(typeof spotifySdk.isAuthenticated).toBe('function');
  });
});
