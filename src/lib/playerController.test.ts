import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./spotify', () => ({
  play: vi.fn(),
  pause: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
}));

vi.mock('./deviceManager', () => ({
  ensureActiveDevice: vi.fn(() => Promise.resolve(null)),
}));

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
  });

  it('delegates play to spotify.play with optional deviceId', async () => {
    await controllerPlay();
    // play now accepts optional deviceId as second param
    expect(restPlay).toHaveBeenCalledTimes(1);
    expect(restPlay).toHaveBeenCalledWith(undefined); // deviceId is undefined when no device selected
  });

  it('delegates pause to spotify.pause with optional deviceId', async () => {
    await controllerPause();
    expect(restPause).toHaveBeenCalledTimes(1);
    expect(restPause).toHaveBeenCalledWith(undefined);
  });

  it('delegates next to spotify.next', async () => {
    await controllerNext();
    expect(restNext).toHaveBeenCalledTimes(1);
  });

  it('delegates previous to spotify.previous', async () => {
    await controllerPrevious();
    expect(restPrev).toHaveBeenCalledTimes(1);
  });

  it('delegates seek to spotify.seek with optional deviceId', async () => {
    await controllerSeek(15000);
    // seek now accepts position and optional deviceId
    expect(restSeek).toHaveBeenCalledWith(15000, undefined);
  });

  it('delegates setVolume to spotify.setVolume with optional deviceId', async () => {
    await controllerSetVolume(75);
    // setVolume now accepts volume and optional deviceId
    expect(restSetVolume).toHaveBeenCalledWith(75, undefined);
  });
});
