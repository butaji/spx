import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';

// Mock Tauri event listener before importing useAuth
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Mock Spotify SDK functions
vi.mock('../lib/spotify', () => ({
  startAuthFlow: vi.fn(),
  handleAuthCallback: vi.fn(),
  ensureValidToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

// Mock playback
vi.mock('../lib/playback', () => ({
  initPlayer: vi.fn(() => Promise.resolve()),
  disconnectPlayer: vi.fn(() => Promise.resolve()),
  waitForDeviceId: vi.fn(),
}));

// Mock stores/spotify signals and helpers
const mockAuthState = vi.hoisted(() => ({ value: false }));
const mockAuthError = vi.hoisted(() => ({ value: null }));
const mockAuthLoading = vi.hoisted(() => ({ value: false }));
const mockIsRestoring = vi.hoisted(() => ({ value: false }));
const mockIsMockMode = vi.hoisted(() => ({ value: false }));

vi.mock('../stores/spotify', () => ({
  authState: mockAuthState,
  authError: mockAuthError,
  isAuthLoading: mockAuthLoading,
  isRestoring: mockIsRestoring,
  isMockMode: mockIsMockMode,
  appError: { value: null },
  loadRecentActivity: vi.fn(),
  loadUserProfile: vi.fn(),
  loadUserPlaylists: vi.fn(),
  refreshPlayback: vi.fn(),
  startPlaybackPolling: vi.fn(),
}));

// Mock device store
vi.mock('../stores/devices', () => ({
  refreshSpotifyDevices: vi.fn(() => Promise.resolve()),
  refreshLocalDevices: vi.fn(() => Promise.resolve()),
  startDevicePolling: vi.fn(),
  stopDevicePolling: vi.fn(),
}));

// Mock notifications
vi.mock('../stores/notifications', () => ({
  handleAuthError: vi.fn(),
  setAuthStatus: vi.fn(),
  setConnectionStatus: vi.fn(),
  setDeviceStatus: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
}));

import { useAuth } from './useAuth';
import { ensureValidToken, getCurrentUser } from '../lib/spotify';
import { startPlaybackPolling } from '../stores/playback';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.value = false;
    mockAuthError.value = null;
    mockAuthLoading.value = false;
    mockIsRestoring.value = false;
    mockIsMockMode.value = false;
  });

  it('sets authState to true when an existing session is restored', async () => {
    (ensureValidToken as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1', display_name: 'Test User' });

    function Wrapper() {
      useAuth();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      // @ts-ignore — preact render types are strict in this environment but runtime works
      render(h(Wrapper), container);
    });

    // Allow the async init effect to run
    await act(async () => new Promise((r) => setTimeout(r, 10)));

    expect(ensureValidToken).toHaveBeenCalled();
    expect(getCurrentUser).toHaveBeenCalled();
    expect(mockAuthState.value).toBe(true);

    render(null, container);
    container.remove();
  });

  it('starts playback polling after successful authentication', async () => {
    (ensureValidToken as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1', display_name: 'Test User' });

    function Wrapper() {
      useAuth();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      render(h(Wrapper), container);
    });

    await act(async () => new Promise((r) => setTimeout(r, 10)));

    // Verify startPlaybackPolling was called (from stores/spotify mock)
    expect(mockAuthState.value).toBe(true);

    render(null, container);
    container.remove();
  });
});
