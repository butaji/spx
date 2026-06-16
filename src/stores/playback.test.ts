import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  startPlaybackPolling,
  stopPlaybackPolling,
  setIsPlayingOptimistic,
  setProgressOptimistic,
  refreshLikedStatus,
  resetPlaybackUserActionCooldown,
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
    resetPlaybackUserActionCooldown();
  });

  afterEach(() => {
    stopPlaybackPolling();
  });

  // ─── Buffered State Initialization ─────────────────────────────────────────

  describe('buffered state initialization', () => {
    it('initializes with correct default values', () => {
      expect(isPlaying.value).toBe(false);
      expect(playbackProgress.value).toBe(0);
      expect(playbackDuration.value).toBe(0);
    });

    it('buffer tracks trackId as null initially', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        progress_ms: 0,
        is_playing: false,
      });

      await refreshPlayback();
      expect(playbackProgress.value).toBe(0);
    });

    it('buffer is isolated from signal changes', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-1',
          name: 'Test Track',
          uri: 'spotify:track:1',
          duration_ms: 180000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 5000,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();
      expect(playbackProgress.value).toBe(5000);
      expect(isPlaying.value).toBe(false);
    });
  });

  // ─── setIsPlayingOptimistic ─────────────────────────────────────────────────

  describe('setIsPlayingOptimistic', () => {
    it('updates isPlaying signal immediately', () => {
      expect(isPlaying.value).toBe(false);
      
      setIsPlayingOptimistic(true);
      
      expect(isPlaying.value).toBe(true);
    });

    it('updates isPlaying signal to false', () => {
      isPlaying.value = true;
      
      setIsPlayingOptimistic(false);
      
      expect(isPlaying.value).toBe(false);
    });

    it('can toggle multiple times', () => {
      setIsPlayingOptimistic(true);
      expect(isPlaying.value).toBe(true);
      
      setIsPlayingOptimistic(false);
      expect(isPlaying.value).toBe(false);
      
      setIsPlayingOptimistic(true);
      expect(isPlaying.value).toBe(true);
    });

    it('does not throw when called multiple times', () => {
      expect(() => setIsPlayingOptimistic(true)).not.toThrow();
      expect(() => setIsPlayingOptimistic(false)).not.toThrow();
      expect(() => setIsPlayingOptimistic(true)).not.toThrow();
    });
  });

  // ─── setProgressOptimistic ──────────────────────────────────────────────────

  describe('setProgressOptimistic', () => {
    it('updates playbackProgress signal immediately', () => {
      expect(playbackProgress.value).toBe(0);
      
      setProgressOptimistic(30000);
      
      expect(playbackProgress.value).toBe(30000);
    });

    it('accepts large seek positions', () => {
      setProgressOptimistic(180000);
      expect(playbackProgress.value).toBe(180000);
    });

    it('accepts zero position', () => {
      setProgressOptimistic(5000);
      setProgressOptimistic(0);
      expect(playbackProgress.value).toBe(0);
    });

    it('updates multiple times in sequence', () => {
      setProgressOptimistic(10000);
      expect(playbackProgress.value).toBe(10000);
      
      setProgressOptimistic(25000);
      expect(playbackProgress.value).toBe(25000);
      
      setProgressOptimistic(60000);
      expect(playbackProgress.value).toBe(60000);
    });
  });

  // ─── playTrack Optimistic Update ───────────────────────────────────────────

  describe('playTrack optimistic update', () => {
    it('calls controllerPlay', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      
      await playTrack();
      
      expect(controllerPlay).toHaveBeenCalledTimes(1);
    });

    it('sets isPlaying to true on success', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      
      await playTrack();
      
      expect(isPlaying.value).toBe(true);
    });

    it('reverts optimistic update on error', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Playback failed'));
      
      await playTrack();
      
      expect(isPlaying.value).toBe(false);
    });

    it('handles 503 errors without throwing', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('503 Service Unavailable'));
      
      // Should not throw
      await expect(playTrack()).resolves.toBeUndefined();
    });

    it('handles 502 errors without throwing', async () => {
      (controllerPlay as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('502 Bad gateway'));
      
      await expect(playTrack()).resolves.toBeUndefined();
    });
  });

  // ─── pauseTrack Optimistic Update ─────────────────────────────────────────

  describe('pauseTrack optimistic update', () => {
    it('calls controllerPause', async () => {
      (controllerPause as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      
      await pauseTrack();
      
      expect(controllerPause).toHaveBeenCalledTimes(1);
    });

    it('sets isPlaying to false on success', async () => {
      isPlaying.value = true;
      (controllerPause as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      
      await pauseTrack();
      
      expect(isPlaying.value).toBe(false);
    });

    it('reverts optimistic update on error', async () => {
      isPlaying.value = false;
      (controllerPause as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Pause failed'));
      
      await pauseTrack();
      
      // On error, it tries to revert by setting isPlaying back to true
      expect(isPlaying.value).toBe(true);
    });

    it('handles 503 errors without throwing', async () => {
      isPlaying.value = false;
      (controllerPause as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('503 Service Unavailable'));
      
      // Should not throw
      await expect(pauseTrack()).resolves.toBeUndefined();
    });

    it('handles 502 errors without throwing', async () => {
      isPlaying.value = false;
      (controllerPause as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('502 Bad gateway'));
      
      await expect(pauseTrack()).resolves.toBeUndefined();
    });
  });

  // ─── RAF-based Progress Updates ─────────────────────────────────────────────

  describe('RAF-based progress updates', () => {
    it('progress signal updates from refreshPlayback', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-1',
          name: 'Test Track',
          uri: 'spotify:track:1',
          duration_ms: 180000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 10000,
        is_playing: true,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();
      
      // Progress should be set from API
      expect(playbackProgress.value).toBeGreaterThanOrEqual(10000);
      expect(playbackDuration.value).toBe(180000);
      expect(isPlaying.value).toBe(true);
    });

    it('progress updates with setProgressOptimistic', async () => {
      setProgressOptimistic(50000);
      
      expect(playbackProgress.value).toBe(50000);
    });

    it('duration is set from track on refresh', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-1',
          name: 'Test Track',
          uri: 'spotify:track:1',
          duration_ms: 240000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 0,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();
      
      expect(playbackDuration.value).toBe(240000);
    });
  });

  // ─── refreshPlayback Updates Buffer ───────────────────────────────────────

  describe('refreshPlayback updates buffer', () => {
    it('updates track from API state', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-1',
          name: 'Test Track',
          uri: 'spotify:track:1',
          duration_ms: 180000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 25000,
        is_playing: true,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();

      expect(playbackTrack.value?.id).toBe('track-1');
      expect(playbackDuration.value).toBe(180000);
      expect(isPlaying.value).toBe(true);
    });

    it('buffer resets when track changes', async () => {
      // First track
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-1',
          name: 'Track 1',
          uri: 'spotify:track:1',
          duration_ms: 180000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 10000,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();
      expect(playbackTrack.value?.id).toBe('track-1');
      expect(playbackDuration.value).toBe(180000);

      // New track
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: {
          id: 'track-2',
          name: 'Track 2',
          uri: 'spotify:track:2',
          duration_ms: 240000,
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [{ url: 'img.jpg' }] },
        },
        progress_ms: 0,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();
      
      // Should update to new track
      expect(playbackTrack.value?.id).toBe('track-2');
      expect(playbackDuration.value).toBe(240000);
    });

    it('updates shuffle state', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        progress_ms: 0,
        is_playing: false,
        shuffle_state: true,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();

      expect(playbackShuffle.value).toBe(true);
    });

    it('updates repeat state', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        progress_ms: 0,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'track',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();

      expect(playbackRepeat.value).toBe('track');
    });

    it('updates volume from device', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        progress_ms: 0,
        is_playing: false,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 50 },
      });

      await refreshPlayback();

      expect(playbackVolume.value).toBe(50);
    });

    it('sets isPlaying based on API state', async () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue({
        item: null,
        progress_ms: 0,
        is_playing: true,
        shuffle_state: false,
        repeat_state: 'off',
        device: { volume_percent: 100 },
      });

      await refreshPlayback();

      expect(isPlaying.value).toBe(true);
    });
  });

  // ─── Playback Polling ───────────────────────────────────────────────────────

  describe('playback polling', () => {
    it('startPlaybackPolling returns stop function', () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      
      const stop = startPlaybackPolling();
      expect(typeof stop).toBe('function');
      
      stop();
    });

    it('startPlaybackPolling can be stopped', () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      
      const stop = startPlaybackPolling();
      expect(() => stop()).not.toThrow();
    });

    it('stopPlaybackPolling can be called multiple times safely', () => {
      stopPlaybackPolling();
      expect(() => stopPlaybackPolling()).not.toThrow();
    });

    it('startPlaybackPolling can be called multiple times safely', () => {
      (getPlaybackState as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      
      startPlaybackPolling();
      expect(() => startPlaybackPolling()).not.toThrow();
    });
  });

  // ─── Existing Tests (Maintained for Compatibility) ─────────────────────────

  describe('refreshPlayback (existing tests)', () => {
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
