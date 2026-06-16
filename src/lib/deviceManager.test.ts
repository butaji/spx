import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockCurrentDeviceId = vi.hoisted(() => createMockSignal<string | null>(null));

vi.mock('../stores/devices', () => ({
  refreshSpotifyDevices: vi.fn(),
  refreshLocalDevices: vi.fn(),
  availableDevices: createMockSignal<any[]>([]),
  allDevices: createMockSignal<any[]>([]),
  selectedDeviceId: createMockSignal<string | null>(null),
  selectDevice: vi.fn(),
  isTransferring: createMockSignal<boolean>(false),
}));

vi.mock('./spotify', () => ({
  transferPlayback: vi.fn(),
}));

vi.mock('./playback', () => ({
  get currentDeviceId() {
    return mockCurrentDeviceId.value;
  },
  waitForDeviceId: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../stores/notifications', () => ({
  handleDeviceError: vi.fn(),
  setDeviceStatus: vi.fn(),
}));

import { refreshLocalDevices, availableDevices as rawAvailableDevices, allDevices as rawAllDevices, selectedDeviceId as rawSelectedDeviceId, selectDevice } from '../stores/devices';
import { transferPlayback } from './spotify';
import { waitForDeviceId } from './playback';

const availableDevices = rawAvailableDevices as { value: any[] };
const allDevices = rawAllDevices as { value: any[] };
const selectedDeviceId = rawSelectedDeviceId as { value: string | null };

describe('ensureActiveDevice', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    availableDevices.value = [];
    allDevices.value = [];
    selectedDeviceId.value = null;
    mockCurrentDeviceId.value = null;
  });

  it('returns the active device id when one exists', async () => {
    availableDevices.value = [{ id: 'active-dev', name: 'Active', is_active: true }];
    allDevices.value = [{ id: 'active-dev', name: 'Active', is_active: true }];

    const { ensureActiveDevice } = await import('./deviceManager');
    const id = await ensureActiveDevice();

    expect(id).toBe('active-dev');
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('transfers to the user-selected device', async () => {
    availableDevices.value = [{ id: 'dev1', name: 'Device 1', is_active: false }];
    allDevices.value = [{ id: 'dev1', name: 'Device 1', is_active: false }];
    selectedDeviceId.value = 'dev1';
    (selectDevice as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { ensureActiveDevice } = await import('./deviceManager');
    const id = await ensureActiveDevice();

    expect(id).toBe('dev1');
    expect(selectDevice).toHaveBeenCalledWith('dev1', undefined);
  });

  it('falls back to a Spotify Connect device when nothing is selected', async () => {
    availableDevices.value = [{ id: 'connect-dev', name: 'Speaker', is_active: false, isLocal: false }];
    allDevices.value = [{ id: 'connect-dev', name: 'Speaker', is_active: false, isLocal: false }];

    const { ensureActiveDevice } = await import('./deviceManager');
    const id = await ensureActiveDevice();

    expect(id).toBe('connect-dev');
    expect(transferPlayback).toHaveBeenCalledWith('connect-dev', false);
  });

  it('waits for the SPX Player when no other device exists', async () => {
    availableDevices.value = [];
    allDevices.value = [];
    mockCurrentDeviceId.value = null;
    (waitForDeviceId as ReturnType<typeof vi.fn>).mockResolvedValue('spx-player');

    const { ensureActiveDevice } = await import('./deviceManager');
    const id = await ensureActiveDevice();

    expect(id).toBe('spx-player');
    expect(transferPlayback).toHaveBeenCalledWith('spx-player', false);
  });

  it('scans local network when Spotify API returns no devices', async () => {
    availableDevices.value = [];
    allDevices.value = [];

    const { ensureActiveDevice } = await import('./deviceManager');
    await ensureActiveDevice();

    expect(refreshLocalDevices).toHaveBeenCalledWith(true);
  });

  it('returns null when no device is available', async () => {
    availableDevices.value = [];
    allDevices.value = [];
    (waitForDeviceId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { ensureActiveDevice } = await import('./deviceManager');
    const id = await ensureActiveDevice();

    expect(id).toBeNull();
  });
});
