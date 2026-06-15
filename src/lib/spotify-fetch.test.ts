import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage
let localStorageStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { localStorageStore = {}; }),
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { logout } from './spotify';

describe('spotify module lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};
  });

  it('logout clears token storage', async () => {
    localStorageStore['spx_spotify_token'] = JSON.stringify({
      accessToken: 'test_token',
      expiresAt: Date.now() + 3600000,
    });

    await logout();

    expect(localStorage.removeItem).toHaveBeenCalledWith('spx_spotify_token');
  });

  it('logout does not throw', () => {
    // Should not throw
    expect(() => logout()).not.toThrow();
  });
});
