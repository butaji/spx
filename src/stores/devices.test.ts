import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock dependencies before importing devices store ──────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../lib/spotify', () => ({
  getAvailableDevices: vi.fn(),
  scanLocalDevices: vi.fn(),
  transferPlayback: vi.fn(),
}));

vi.mock('../lib/playback', () => ({
  currentDeviceId: 'web-sdk-device-id',
}));

vi.mock('../lib/utils', () => ({
  debug: vi.fn(),
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { getAvailableDevices, scanLocalDevices, transferPlayback } from '../lib/spotify';
import {
  availableDevices,
  localDevices,
  activeDevice,
  isScanning,
  scanError,
  isTransferring,
  allDevices,
  selectedDeviceId,
  refreshDevices,
  refreshLocalDevices,
  clearDeviceSelection,
  __resetDeviceStore,
} from './devices';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mockGetAvailableDevices(devices: any[]) {
  (getAvailableDevices as ReturnType<typeof vi.fn>).mockResolvedValue({ devices });
}

function mockGetAvailableDevicesError(msg: string) {
  (getAvailableDevices as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(msg));
}

function mockScanLocalDevices(devices: any[]) {
  (scanLocalDevices as ReturnType<typeof vi.fn>).mockResolvedValue(devices);
  return scanLocalDevices as ReturnType<typeof vi.fn>;
}

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ─── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });

  // Reset all module-level state (signals + private variables)
  __resetDeviceStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST 1: refreshDevices scans local even when Spotify fails
// ══════════════════════════════════════════════════════════════════════════════

describe('refreshDevices — Spotify failure tolerance', () => {

  it('scans local even when getAvailableDevices throws "Not authenticated"', async () => {
    // Arrange
    mockGetAvailableDevicesError('Not authenticated');
    mockScanLocalDevices([
      { name: 'Living Room speaker', ip: '192.168.1.10', port: 80, service_type: '_spotify-connect._tcp.local.' },
      { name: 'Bedroom speaker', ip: '192.168.1.11', port: 80, service_type: '_spotify-connect._tcp.local.' },
    ]);

    // Act
    const promise = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    // Assert — localDevices populated even though Spotify failed
    expect(localDevices.value).toHaveLength(2);
    expect(localDevices.value.map(d => d.name)).toEqual(['Living Room speaker', 'Bedroom speaker']);

    // Assert — availableDevices stayed empty (Spotify failed)
    expect(availableDevices.value).toHaveLength(0);

    // Assert — no error was thrown from refreshDevices
    expect(scanError.value).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST 2: Device deduplication — Spotify + local merged into one entry
// ══════════════════════════════════════════════════════════════════════════════

describe('Device deduplication', () => {

  it('merges Spotify and local devices with the same name (no duplicate)', async () => {
    // Arrange — Spotify returns a device
    mockGetAvailableDevices([
      {
        id: 'abc123',
        name: 'Living Room speaker',
        type: 'speaker',
        is_active: false,
        is_restricted: false,
      },
    ]);
    // Local scan returns a device with the same name but different IP
    mockScanLocalDevices([
      { name: 'Living Room speaker', ip: '192.168.1.10', port: 80, service_type: '_spotify-connect._tcp.local.' },
    ]);

    // Act
    const promise = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    // Assert — only 1 device in allDevices (merged, not duplicated)
    expect(allDevices.value).toHaveLength(1);

    const merged = allDevices.value[0];

    // Assert — has the Spotify ID (merged, not local-only)
    expect(merged.id).toBe('abc123');

    // Assert — merged device has canTransfer=true (from Spotify) and isLocal=false
    expect(merged.canTransfer).toBe(true);
    expect(merged.isLocal).toBe(false);
  });

  it('keeps Spotify and local separate when names do not match', async () => {
    mockGetAvailableDevices([
      {
        id: 'abc123',
        name: 'Living Room speaker',
        type: 'speaker',
        is_active: false,
        is_restricted: false,
      },
    ]);
    mockScanLocalDevices([
      { name: 'Office speaker', ip: '192.168.1.20', port: 80, service_type: '_spotify-connect._tcp.local.' },
    ]);

    const promise = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    // Both should be present (different names)
    expect(allDevices.value).toHaveLength(2);
    expect(allDevices.value.find(d => d.id === 'abc123')).toBeDefined();
    expect(allDevices.value.find(d => d.name === 'Office speaker')).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST 3: Cast-only devices appear in dropdown
// ══════════════════════════════════════════════════════════════════════════════

describe('Cast-only devices', () => {

  it('shows Cast devices from local scan when Spotify returns nothing', async () => {
    // Arrange
    mockGetAvailableDevices([]);
    mockScanLocalDevices([
      {
        name: 'Chromecast Audio #1',
        ip: '192.168.1.50',
        port: 8009,
        service_type: '_googlecast._tcp.local.',
      },
      {
        name: 'Chromecast Audio #2',
        ip: '192.168.1.51',
        port: 8009,
        service_type: '_googlecast._tcp.local.',
      },
      {
        name: 'Nest Hub',
        ip: '192.168.1.52',
        port: 8009,
        service_type: '_googlecast._tcp.local.',
      },
    ]);

    // Act
    const promise = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    // Assert — all 3 Cast devices appear
    expect(allDevices.value).toHaveLength(3);

    for (const device of allDevices.value) {
      expect(device.needsWakeUp).toBe(true);
      expect(device.canTransfer).toBe(true);
      expect(device.isLocal).toBe(true);
    }

    // Assert — each has a unique IP-based ID
    const ids = allDevices.value.map(d => d.id);
    expect(ids).toContain('192.168.1.50');
    expect(ids).toContain('192.168.1.51');
    expect(ids).toContain('192.168.1.52');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST 4: Cooldown logic — local scan respects 15-second cooldown
// ══════════════════════════════════════════════════════════════════════════════

describe('Local scan cooldown', () => {

  it('blocks a second local scan when called within cooldown window', async () => {
    // Arrange
    mockGetAvailableDevices([]);
    const scanMock = mockScanLocalDevices([
      { name: 'Speaker A', ip: '192.168.1.60', port: 80, service_type: '_spotify-connect._tcp.local.' },
    ]);

    // Act — first scan
    const p1 = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await p1;

    // scanLocalDevices was called once
    expect(scanMock).toHaveBeenCalledTimes(1);

    // Act — second call within cooldown window (no force)
    const p2 = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await p2;

    // scanLocalDevices should NOT have been called again
    expect(scanMock).toHaveBeenCalledTimes(1);
  });

  it('forces a second local scan when force=true even within cooldown', async () => {
    // Arrange
    mockGetAvailableDevices([]);
    const scanMock = mockScanLocalDevices([
      { name: 'Speaker A', ip: '192.168.1.60', port: 80, service_type: '_spotify-connect._tcp.local.' },
    ]);

    // Act — first scan
    const p1 = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await p1;

    expect(scanMock).toHaveBeenCalledTimes(1);

    // Act — second scan with force=true
    const p2 = refreshDevices({ includeLocal: true, force: true });
    await vi.advanceTimersByTimeAsync(0);
    await p2;

    // scanLocalDevices should have been called again
    expect(scanMock).toHaveBeenCalledTimes(2);
  });

  it('allows a new local scan after cooldown period (16s) has passed', async () => {
    // Arrange
    mockGetAvailableDevices([]);
    const scanMock = mockScanLocalDevices([
      { name: 'Speaker A', ip: '192.168.1.60', port: 80, service_type: '_spotify-connect._tcp.local.' },
    ]);

    // Act — first scan
    const p1 = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await p1;

    expect(scanMock).toHaveBeenCalledTimes(1);

    // Advance time past the 15-second cooldown
    await vi.advanceTimersByTimeAsync(16_000);

    // Act — third scan after cooldown
    const p3 = refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);
    await p3;

    // scanLocalDevices should have been called again
    expect(scanMock).toHaveBeenCalledTimes(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST 5: selectDevice with Cast device — full flow
// ══════════════════════════════════════════════════════════════════════════════

describe('selectDevice with Cast device', () => {

  it('transfers playback to a Cast device after waking it', async () => {
    // Arrange
    mockGetAvailableDevices([]);

    // Populate the local Cast device into allDevices
    mockScanLocalDevices([
      {
        name: 'Chromecast',
        ip: '192.168.1.70',
        port: 8009,
        service_type: '_googlecast._tcp.local.',
      },
    ]);

    await refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);

    // Mock wakeDevice — simulate the Rust command
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue('Chromecast woken');

    // Mock getAvailableDevices for waitForDevice polling — Cast device appears after 1 poll
    let pollCount = 0;
    (getAvailableDevices as ReturnType<typeof vi.fn>).mockImplementation(() => {
      pollCount++;
      if (pollCount === 1) return Promise.resolve({ devices: [] });
      return Promise.resolve({
        devices: [{ id: 'cast-spotify-id', name: 'Chromecast', type: 'cast_audio', is_active: false, is_restricted: false }],
      });
    });

    (transferPlayback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Find the Cast device in allDevices
    const castDevice = allDevices.value.find(d => d.name === 'Chromecast');
    expect(castDevice).toBeDefined();

    // Act
    const result = await import('./devices').then(m =>
      m.selectDevice(castDevice!.id!, (castDevice as any).deviceIp)
    );

    // Assert
    expect(result.success).toBe(true);

    // Assert isTransferring is reset
    const { isTransferring: transferringSignal } = await import('./devices');
    expect(transferringSignal.value).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST 6: selectDevice timeout handling
// ══════════════════════════════════════════════════════════════════════════════

describe('selectDevice timeout handling', () => {

  it('resets isTransferring and returns error when wakeDevice times out', async () => {
    // Arrange — Spotify has a Cast device
    mockGetAvailableDevices([
      {
        id: 'cast-spotify-id',
        name: 'Chromecast',
        type: 'cast_audio',
        is_active: false,
        is_restricted: false,
      },
    ]);
    mockScanLocalDevices([
      {
        name: 'Chromecast',
        ip: '192.168.1.70',
        port: 8009,
        service_type: '_googlecast._tcp.local.',
      },
    ]);

    await refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);

    // Mock wakeDevice to reject immediately (simulates timeout error)
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Cast device wake timed out after 15 seconds")
    );

    // Mock getAvailableDevices to return empty (so refreshSpotifyDevices doesn't hang)
    (getAvailableDevices as ReturnType<typeof vi.fn>).mockResolvedValue({ devices: [] });

    // Act
    const castDevice = allDevices.value.find(d => d.name === 'Chromecast');
    const result = await import('./devices').then(m =>
      m.selectDevice(castDevice!.id!, (castDevice as any).deviceIp)
    );

    // Assert error returned
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    // Assert isTransferring is reset
    const { isTransferring: transferringSignal } = await import('./devices');
    expect(transferringSignal.value).toBe(false);
  }, 10000);

  it('returns error when device never appears in Spotify Connect after wake', async () => {
    // Arrange
    mockGetAvailableDevices([]);
    mockScanLocalDevices([
      {
        name: 'Chromecast',
        ip: '192.168.1.70',
        port: 8009,
        service_type: '_googlecast._tcp.local.',
      },
    ]);

    await refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);

    // Mock wakeDevice succeeds
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue('Chromecast woken');

    // Mock getAvailableDevices to always return empty (device never appears)
    (getAvailableDevices as ReturnType<typeof vi.fn>).mockResolvedValue({ devices: [] });

    const castDevice = allDevices.value.find(d => d.name === 'Chromecast');

    // Act — waitForDevice polls 15 times × 1000ms = 15s before throwing
    const resultPromise = import('./devices').then(m =>
      m.selectDevice(castDevice!.id!, (castDevice as any).deviceIp)
    );
    await vi.advanceTimersByTimeAsync(16_000);
    const result = await resultPromise;

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("official Spotify app");
  }, 20000);
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST: clearDeviceSelection resets all state
// ══════════════════════════════════════════════════════════════════════════════

describe('clearDeviceSelection', () => {
  it('clears all device signals', async () => {
    mockGetAvailableDevices([{ id: 'dev1', name: 'Device 1', type: 'speaker', is_active: false, is_restricted: false }]);
    mockScanLocalDevices([{ name: 'Local 1', ip: '192.168.1.1', port: 80 }]);

    await refreshDevices({ includeLocal: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(allDevices.value.length).toBeGreaterThan(0);

    clearDeviceSelection();

    expect(availableDevices.value).toHaveLength(0);
    expect(localDevices.value).toHaveLength(0);
    expect(activeDevice.value).toBeNull();
    expect(selectedDeviceId.value).toBeNull();
    expect(isTransferring.value).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST: refreshLocalDevices convenience function
// ══════════════════════════════════════════════════════════════════════════════

describe('refreshLocalDevices', () => {
  it('calls refreshDevices with includeLocal:true and the force flag', async () => {
    mockGetAvailableDevices([]);
    mockScanLocalDevices([{ name: 'Speaker', ip: '192.168.1.1', port: 80 }]);

    await refreshLocalDevices(false);
    await vi.advanceTimersByTimeAsync(0);

    // Should have scanned (first call, no cooldown)
    expect(scanLocalDevices).toHaveBeenCalled();
  });

  it('respects cooldown when called without force', async () => {
    mockGetAvailableDevices([]);
    const scanMock = mockScanLocalDevices([{ name: 'Speaker', ip: '192.168.1.1', port: 80 }]);

    await refreshLocalDevices(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(scanMock).toHaveBeenCalledTimes(1);

    await refreshLocalDevices(false);
    await vi.advanceTimersByTimeAsync(0);
    // Blocked by cooldown
    expect(scanMock).toHaveBeenCalledTimes(1);
  });
});
