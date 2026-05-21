import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be defined inside vi.mock factories because vi.mock is hoisted
vi.mock('./playback', () => ({
  getDeviceId: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  skipNext: vi.fn(),
  skipPrevious: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
}));

vi.mock('./spotify', () => ({
  play: vi.fn(),
  pause: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
}));

let activeDeviceValue: { id?: string } | null = null;
vi.mock('../stores/devices', () => ({
  activeDevice: {
    get value() { return activeDeviceValue; },
  },
}));

import {
  getDeviceId,
  resume as sdkResume,
  pause as sdkPause,
  skipNext as sdkNext,
  skipPrevious as sdkPrev,
  seek as sdkSeek,
  setVolume as sdkSetVolume,
} from './playback';
import {
  play as restPlay,
  pause as restPause,
  next as restNext,
  previous as restPrev,
  seek as restSeek,
  setVolume as restSetVolume,
} from './spotify';
import {
  controllerPlay,
  controllerPause,
  controllerNext,
  controllerPrevious,
  controllerSeek,
  controllerSetVolume,
} from './playerController';

describe('playerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeDeviceValue = null;
  });

  describe('when SPX Player is active', () => {
    beforeEach(() => {
      (getDeviceId as ReturnType<typeof vi.fn>).mockReturnValue('spx-device-123');
      activeDeviceValue = { id: 'spx-device-123' };
    });

    it('routes play to SDK resume', async () => {
      await controllerPlay();
      expect(sdkResume).toHaveBeenCalledTimes(1);
      expect(restPlay).not.toHaveBeenCalled();
    });

    it('routes pause to SDK pause', async () => {
      await controllerPause();
      expect(sdkPause).toHaveBeenCalledTimes(1);
      expect(restPause).not.toHaveBeenCalled();
    });

    it('routes next to SDK skipNext', async () => {
      await controllerNext();
      expect(sdkNext).toHaveBeenCalledTimes(1);
      expect(restNext).not.toHaveBeenCalled();
    });

    it('routes previous to SDK skipPrevious', async () => {
      await controllerPrevious();
      expect(sdkPrev).toHaveBeenCalledTimes(1);
      expect(restPrev).not.toHaveBeenCalled();
    });

    it('routes seek to SDK seek', async () => {
      await controllerSeek(15000);
      expect(sdkSeek).toHaveBeenCalledWith(15000);
      expect(restSeek).not.toHaveBeenCalled();
    });

    it('routes setVolume to SDK setVolume (converts percent to 0-1)', async () => {
      await controllerSetVolume(75);
      expect(sdkSetVolume).toHaveBeenCalledWith(0.75);
      expect(restSetVolume).not.toHaveBeenCalled();
    });
  });

  describe('when another device is active', () => {
    beforeEach(() => {
      (getDeviceId as ReturnType<typeof vi.fn>).mockReturnValue('spx-device-123');
      activeDeviceValue = { id: 'other-device-456' };
    });

    it('routes play to REST API with deviceId', async () => {
      await controllerPlay('other-device-456');
      expect(restPlay).toHaveBeenCalledWith('other-device-456');
      expect(sdkResume).not.toHaveBeenCalled();
    });

    it('routes pause to REST API', async () => {
      await controllerPause();
      expect(restPause).toHaveBeenCalledTimes(1);
      expect(sdkPause).not.toHaveBeenCalled();
    });

    it('routes next to REST API', async () => {
      await controllerNext();
      expect(restNext).toHaveBeenCalledTimes(1);
      expect(sdkNext).not.toHaveBeenCalled();
    });

    it('routes previous to REST API', async () => {
      await controllerPrevious();
      expect(restPrev).toHaveBeenCalledTimes(1);
      expect(sdkPrev).not.toHaveBeenCalled();
    });

    it('routes seek to REST API', async () => {
      await controllerSeek(15000);
      expect(restSeek).toHaveBeenCalledWith(15000);
      expect(sdkSeek).not.toHaveBeenCalled();
    });

    it('routes setVolume to REST API (keeps percent)', async () => {
      await controllerSetVolume(75);
      expect(restSetVolume).toHaveBeenCalledWith(75);
      expect(sdkSetVolume).not.toHaveBeenCalled();
    });
  });

  describe('when no SDK device is registered', () => {
    beforeEach(() => {
      (getDeviceId as ReturnType<typeof vi.fn>).mockReturnValue(null);
      activeDeviceValue = { id: 'some-device' };
    });

    it('falls back to REST API for play', async () => {
      await controllerPlay();
      expect(restPlay).toHaveBeenCalledTimes(1);
      expect(sdkResume).not.toHaveBeenCalled();
    });
  });
});
