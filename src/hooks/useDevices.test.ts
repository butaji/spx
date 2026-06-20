import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { useDevices } from './useDevices';
import type { SpotifyDevice } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createMockSignal<T>(initial: T): { value: T } {
  let value = initial;
  return {
    get value() {
      return value;
    },
    set value(v: T) {
      value = v;
    },
  };
}

function renderUseDevices() {
  let result: ReturnType<typeof useDevices> | undefined;

  function Wrapper() {
    result = useDevices();
    return null;
  }

  // @ts-ignore — preact render types are strict in this environment but runtime works
  act(() => {
    render(h(Wrapper), document.createElement('div'));
  });

  if (!result) {
    throw new Error('useDevices did not render');
  }

  // Clear mount-effect calls so individual tests only assert on behavior
  // triggered by ensureActiveDevice or user actions.
  (refreshSpotifyDevices as ReturnType<typeof vi.fn>).mockClear();
  (refreshLocalDevices as ReturnType<typeof vi.fn>).mockClear();

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════════

const mockCurrentDeviceId = vi.hoisted(() => ({ value: null as string | null }));
const mockAvailableDevices = vi.hoisted(() => createMockSignal<SpotifyDevice[]>([]));
const mockAllDevices = vi.hoisted(() => createMockSignal<Array<SpotifyDevice & { isLocal?: boolean; deviceIp?: string }>>([]));
const mockSelectedDeviceId = vi.hoisted(() => createMockSignal<string | null>(null));
const mockIsTransferring = vi.hoisted(() => createMockSignal<boolean>(false));

vi.mock('../stores/devices', () => ({
  refreshSpotifyDevices: vi.fn(() => Promise.resolve()),
  refreshLocalDevices: vi.fn(() => Promise.resolve()),
  availableDevices: mockAvailableDevices,
  allDevices: mockAllDevices,
  selectedDeviceId: mockSelectedDeviceId,
  selectDevice: vi.fn(),
  isTransferring: mockIsTransferring,
}));

vi.mock('../lib/spotify', () => ({
  transferPlayback: vi.fn(),
}));

vi.mock('../lib/playback', () => ({
  get currentDeviceId() {
    return mockCurrentDeviceId.value;
  },
  waitForDeviceId: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../stores/notifications', () => ({
  handleDeviceError: vi.fn(),
  setDeviceStatus: vi.fn(),
}));

import {
  refreshSpotifyDevices,
  refreshLocalDevices,
  selectDevice,
} from '../stores/devices';
import { transferPlayback } from '../lib/spotify';
import { handleDeviceError, setDeviceStatus } from '../stores/notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// Setup / Teardown
// ═══════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();

  mockAvailableDevices.value = [];
  mockAllDevices.value = [];
  mockCurrentDeviceId.value = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Happy paths
// ═══════════════════════════════════════════════════════════════════════════════

describe('useDevices', () => {
  describe('ensureActiveDevice — happy paths', () => {
    it('returns the active device id when one exists', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [{ id: 'active-device', name: 'Active Speaker', is_active: true }];
      mockAvailableDevices.value = mockAllDevices.value;

      const result = await ensureActiveDevice();

      expect(refreshSpotifyDevices).toHaveBeenCalledTimes(1);
      expect(setDeviceStatus).toHaveBeenCalledWith('available');
      expect(result).toBe('active-device');
    });

    it('preloads both Spotify and local devices immediately on mount', () => {
      function Wrapper() {
        useDevices();
        return null;
      }

      act(() => {
        render(h(Wrapper), document.createElement('div'));
      });

      expect(refreshSpotifyDevices).toHaveBeenCalledTimes(1);
      expect(refreshLocalDevices).toHaveBeenCalledWith(true);
    });

    it('returns null only after waiting for the SPX Player when there are no devices', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAvailableDevices.value = [];
      mockAllDevices.value = [];

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(16_000);
      const result = await resultPromise;

      expect(setDeviceStatus).toHaveBeenLastCalledWith('none');
      expect(result).toBeNull();
    });

    it('transfers playback to a Spotify Connect device when no device is active', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        { id: 'spotify-device', name: 'Living Room Speaker', is_active: false, isLocal: false },
      ];
      mockAvailableDevices.value = mockAllDevices.value;
      (transferPlayback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await ensureActiveDevice();

      expect(transferPlayback).toHaveBeenCalledTimes(1);
      expect(transferPlayback).toHaveBeenCalledWith('spotify-device', false);
      expect(setDeviceStatus).toHaveBeenCalledWith('available');
      expect(result).toBe('spotify-device');
    });

    it('activates the SPX Player and polls until it becomes active', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [{ id: 'spx-device', name: 'SPX Player', is_active: false, isLocal: true }];
      mockAvailableDevices.value = [];

      (transferPlayback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      let pollCount = 0;
      (refreshSpotifyDevices as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        pollCount += 1;
        if (pollCount >= 4) {
          mockAvailableDevices.value = [{ id: 'spx-device', name: 'SPX Player', is_active: true }];
        }
      });

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await resultPromise;

      expect(transferPlayback).toHaveBeenCalledTimes(1);
      expect(transferPlayback).toHaveBeenCalledWith('spx-device', false);
      expect(result).toBe('spx-device');
    });

    it('returns the SPX Player id even if it never reports as active', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [{ id: 'spx-device', name: 'SPX Player', is_active: false, isLocal: true }];
      mockAvailableDevices.value = [];
      (transferPlayback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(7_000);
      const result = await resultPromise;

      expect(transferPlayback).toHaveBeenCalledWith('spx-device', false);
      expect(result).toBe('spx-device');
    });

    it('always returns the in-app player id as a last resort', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [];
      mockAvailableDevices.value = [];
      mockCurrentDeviceId.value = 'spx-web-player';

      const result = await ensureActiveDevice();

      expect(result).toBe('spx-web-player');
      expect(setDeviceStatus).toHaveBeenLastCalledWith('available');
    });

    it('falls back to selectDevice for the first available device', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        {
          id: 'cast-device',
          name: 'Chromecast',
          is_active: false,
          isLocal: true,
          deviceIp: '192.168.1.10',
        },
      ];
      mockAvailableDevices.value = [];
      (selectDevice as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(16_000);
      const result = await resultPromise;

      expect(selectDevice).toHaveBeenCalledTimes(1);
      expect(selectDevice).toHaveBeenCalledWith('cast-device', '192.168.1.10');
      expect(setDeviceStatus).toHaveBeenLastCalledWith('available');
      expect(result).toBe('cast-device');
    });

    it('waits for the in-app player when currentDeviceId becomes available', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        {
          id: 'cast-device',
          name: 'Chromecast',
          is_active: false,
          isLocal: true,
          deviceIp: '192.168.1.10',
        },
      ];
      mockAvailableDevices.value = [];
      (selectDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Wake timeout',
      });

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(500);
      mockCurrentDeviceId.value = 'web-player-id';
      await vi.advanceTimersByTimeAsync(500);
      const result = await resultPromise;

      expect(setDeviceStatus).toHaveBeenLastCalledWith('available');
      expect(result).toBe('web-player-id');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Local scanning
  // ═════════════════════════════════════════════════════════════════════════════

  describe('ensureActiveDevice — local scanning', () => {
    it('scans local devices when Spotify returns no devices', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAvailableDevices.value = [];
      mockAllDevices.value = [
        { id: 'local-device', name: 'Local Speaker', is_active: true, isLocal: true },
      ];

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(2_000);
      const result = await resultPromise;

      expect(refreshLocalDevices).toHaveBeenCalledWith(true);
      expect(refreshSpotifyDevices).toHaveBeenCalledTimes(2);
      expect(setDeviceStatus).toHaveBeenCalledWith('available');
      expect(result).toBe('local-device');
    });

    it('continues gracefully when local scan fails', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAvailableDevices.value = [];
      mockAllDevices.value = [];
      (refreshLocalDevices as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('mDNS failed'));

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(16_000);
      const result = await resultPromise;

      expect(refreshLocalDevices).toHaveBeenCalledWith(true);
      expect(setDeviceStatus).toHaveBeenLastCalledWith('none');
      expect(result).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Error handling
  // ═════════════════════════════════════════════════════════════════════════════

  describe('ensureActiveDevice — error handling', () => {
    it('handles refreshSpotifyDevices failure', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      const error = new Error('Not authenticated');
      (refreshSpotifyDevices as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const result = await ensureActiveDevice();

      expect(handleDeviceError).toHaveBeenCalledWith(error, 'Device Refresh');
      expect(setDeviceStatus).toHaveBeenCalledWith('error');
      expect(result).toBeNull();
    });

    it('handles transferPlayback failure for Spotify Connect device', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        { id: 'spotify-device', name: 'Living Room Speaker', is_active: false, isLocal: false },
      ];
      mockAvailableDevices.value = mockAllDevices.value;

      const error = new Error('Transfer failed');
      (transferPlayback as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      (selectDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Fallback selection failed',
      });

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(16_000);
      const result = await resultPromise;

      expect(handleDeviceError).toHaveBeenCalledWith(error, 'Device Transfer');
      expect(setDeviceStatus).toHaveBeenLastCalledWith('none');
      expect(result).toBeNull();
    });

    it('returns SPX Player id even when transfer to it fails', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [{ id: 'spx-device', name: 'SPX Player', is_active: false, isLocal: true }];
      mockAvailableDevices.value = [];

      const error = new Error('Activation failed');
      (transferPlayback as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(2_000);
      const result = await resultPromise;

      expect(handleDeviceError).toHaveBeenCalledWith(error, 'SPX Player Activation');
      expect(setDeviceStatus).toHaveBeenLastCalledWith('available');
      expect(result).toBe('spx-device');
    });

    it('handles selectDevice failure', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        {
          id: 'cast-device',
          name: 'Chromecast',
          is_active: false,
          isLocal: true,
          deviceIp: '192.168.1.10',
        },
      ];
      mockAvailableDevices.value = [];
      (selectDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Wake timeout',
      });

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(16_000);
      const result = await resultPromise;

      expect(handleDeviceError).toHaveBeenCalledWith(expect.any(Error), 'Device Selection');
      expect(setDeviceStatus).toHaveBeenLastCalledWith('none');
      expect(result).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═════════════════════════════════════════════════════════════════════════════

  describe('ensureActiveDevice — edge cases', () => {
    it('ignores an active device without an id', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        { name: 'Active No Id', is_active: true },
        { id: 'fallback-device', name: 'Fallback Speaker', is_active: false, isLocal: false },
      ];
      mockAvailableDevices.value = mockAllDevices.value;
      (transferPlayback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await ensureActiveDevice();

      expect(transferPlayback).toHaveBeenCalledTimes(1);
      expect(transferPlayback).toHaveBeenCalledWith('fallback-device', false);
      expect(result).toBe('fallback-device');
    });

    it('prefers non-local Spotify Connect device over SPX Player', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        { id: 'spx-device', name: 'SPX Player', is_active: false, isLocal: true },
        { id: 'spotify-device', name: 'Speaker', is_active: false, isLocal: false },
      ];
      mockAvailableDevices.value = mockAllDevices.value;
      (transferPlayback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await ensureActiveDevice();

      expect(transferPlayback).toHaveBeenCalledTimes(1);
      expect(transferPlayback).toHaveBeenCalledWith('spotify-device', false);
      expect(result).toBe('spotify-device');
    });

    it('skips the currentDeviceId wait loop when it is already set', async () => {
      mockCurrentDeviceId.value = 'web-player-id';
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [
        {
          id: 'cast-device',
          name: 'Chromecast',
          is_active: false,
          isLocal: true,
          deviceIp: '192.168.1.10',
        },
      ];
      mockAvailableDevices.value = [];
      (selectDevice as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Wake timeout',
      });

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(500);
      const result = await resultPromise;

      expect(result).toBe('web-player-id');
    });

    it('returns null when currentDeviceId never appears within the wait window', async () => {
      const { ensureActiveDevice } = renderUseDevices();

      mockAllDevices.value = [];
      mockAvailableDevices.value = [];

      const resultPromise = ensureActiveDevice();
      await vi.advanceTimersByTimeAsync(16_000);
      const result = await resultPromise;

      expect(setDeviceStatus).toHaveBeenLastCalledWith('none');
      expect(result).toBeNull();
    });
  });
});
