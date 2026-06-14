import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/spotify', () => ({
  getPlaybackState: vi.fn(),
  checkSavedTracks: vi.fn(),
}));

vi.mock('../lib/playerController', () => ({
  controllerPlay: vi.fn(),
  controllerPause: vi.fn(),
}));

import { getPlaybackState } from '../lib/spotify';

describe('playback polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startPlaybackPolling begins polling and returns cleanup', async () => {
    (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
      item: null,
      is_playing: false,
    });

    vi.resetModules();
    const { startPlaybackPolling } = await import('./playback');

    const cleanup = startPlaybackPolling();
    expect(typeof cleanup).toBe('function');

    // First call happens immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(getPlaybackState).toHaveBeenCalled();

    // Second call after the 5s polling interval
    await vi.advanceTimersByTimeAsync(5000);
    expect(getPlaybackState).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('stopPlaybackPolling stops the interval', async () => {
    (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
      item: null,
      is_playing: false,
    });

    vi.resetModules();
    const { startPlaybackPolling, stopPlaybackPolling } = await import('./playback');

    startPlaybackPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(getPlaybackState).toHaveBeenCalledTimes(1);

    stopPlaybackPolling();

    // Advance time — should not trigger more calls
    await vi.advanceTimersByTimeAsync(5000);
    expect(getPlaybackState).toHaveBeenCalledTimes(1);
  });

  it('cleanup function stops polling', async () => {
    (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
      item: null,
      is_playing: false,
    });

    vi.resetModules();
    const { startPlaybackPolling } = await import('./playback');

    const cleanup = startPlaybackPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(getPlaybackState).toHaveBeenCalledTimes(1);

    cleanup();

    await vi.advanceTimersByTimeAsync(5000);
    expect(getPlaybackState).toHaveBeenCalledTimes(1);
  });
});
