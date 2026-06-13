import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/spotify', () => ({
  getPlaybackState: vi.fn(),
  checkSavedTracks: vi.fn(),
}));

vi.mock('../lib/retry', () => ({
  withRetry: (fn: () => Promise<any>) => fn(),
}));

vi.mock('../lib/playerController', () => ({
  controllerPlay: vi.fn(),
  controllerPause: vi.fn(),
}));

import { getPlaybackState, checkSavedTracks } from '../lib/spotify';
import { controllerPlay, controllerPause } from '../lib/playerController';
import {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  playbackProgress,
  playbackDuration,
  isPlaying,
  likedTrack,
  refreshPlayback,
  playTrack,
  pauseTrack,
  refreshLikedStatus,
} from './playback';

describe('playback store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset signals
    playbackTrack.value = null;
    playbackVolume.value = 100;
    playbackShuffle.value = false;
    playbackRepeat.value = 'off';
    playbackProgress.value = 0;
    playbackDuration.value = 0;
    isPlaying.value = false;
    likedTrack.value = false;
  });

  describe('refreshPlayback', () => {
    it('updates playback signals from API state', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-1',
          name: 'Test Track',
          uri: 'spotify:track:1',
          duration_ms: 180000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 45000,
        is_playing: true,
        shuffle_state: true,
        repeat_state: 'context',
        device: { volume_percent: 80 },
      });

      await refreshPlayback();

      expect(playbackTrack.value?.id).toBe('track-1');
      expect(playbackDuration.value).toBe(180000);
      expect(playbackProgress.value).toBe(45000);
      expect(isPlaying.value).toBe(true);
      expect(playbackShuffle.value).toBe(true);
      expect(playbackRepeat.value).toBe('context');
      expect(playbackVolume.value).toBe(80);
    });

    it('handles missing track gracefully', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        progress_ms: 0,
        is_playing: false,
      });

      await refreshPlayback();

      expect(playbackTrack.value).toBeNull();
      expect(isPlaying.value).toBe(false);
    });

    it('ignores 502/503 errors silently', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('502 Bad gateway'));
      await refreshPlayback();
      expect(playbackTrack.value).toBeNull();
    });

    it('ignores 401 auth errors silently', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401 Unauthorized'));
      await refreshPlayback();
      expect(playbackTrack.value).toBeNull();
    });

    it('ignores network errors silently', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));
      await refreshPlayback();
      expect(playbackTrack.value).toBeNull();
    });
  });

  describe('playTrack', () => {
    it('calls controllerPlay and refreshes playback', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        is_playing: true,
      });

      await playTrack('device-123');

      expect(controllerPlay).toHaveBeenCalledWith('device-123');
      expect(getPlaybackState).toHaveBeenCalled();
      expect(isPlaying.value).toBe(true);
    });

    it('ignores 502/503 errors', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('503 Service Unavailable'));
      await playTrack();
      // Should not throw
    });
  });

  describe('pauseTrack', () => {
    it('calls controllerPause and refreshes playback', async () => {
      (controllerPause as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        is_playing: false,
      });

      await pauseTrack();

      expect(controllerPause).toHaveBeenCalledTimes(1);
      expect(isPlaying.value).toBe(false);
    });
  });

  describe('refreshLikedStatus', () => {
    it('sets likedTrack to true when track is saved', async () => {
      (checkSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue([true]);
      await refreshLikedStatus('track-1');
      expect(likedTrack.value).toBe(true);
    });

    it('sets likedTrack to false when track is not saved', async () => {
      (checkSavedTracks as ReturnType<typeof vi.fn>).mockResolvedValue([false]);
      await refreshLikedStatus('track-1');
      expect(likedTrack.value).toBe(false);
    });

    it('resets likedTrack when no trackId provided', async () => {
      likedTrack.value = true;
      await refreshLikedStatus(undefined);
      expect(likedTrack.value).toBe(false);
      expect(checkSavedTracks).not.toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      (checkSavedTracks as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
      await refreshLikedStatus('track-1');
      expect(likedTrack.value).toBe(false);
    });
  });
});
