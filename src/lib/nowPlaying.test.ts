import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tauriInvoke
vi.mock('./spotify', async () => {
  const actual = await vi.importActual('./spotify');
  return {
    ...actual as any,
    tauriInvoke: vi.fn(),
  };
});

import { tauriInvoke } from './spotify';
import { updateNowPlaying, clearNowPlaying } from './nowPlaying';

describe('nowPlaying', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateNowPlaying', () => {
    it('should call tauriInvoke with correct params for a track', async () => {
      const track = {
        id: '123',
        name: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' },
        duration_ms: 180000,
      };

      await updateNowPlaying(track, true, 60000);

      expect(tauriInvoke).toHaveBeenCalledWith('update_now_playing', {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        durationMs: 180000,
        elapsedMs: 60000,
        isPlaying: true,
      });
    });

    it('should handle multiple artists', async () => {
      const track = {
        id: '123',
        name: 'Test Song',
        artists: [{ name: 'Artist1' }, { name: 'Artist2' }],
        album: { name: 'Test Album' },
        duration_ms: 180000,
      };

      await updateNowPlaying(track, true, 0);

      expect(tauriInvoke).toHaveBeenCalledWith('update_now_playing', {
        title: 'Test Song',
        artist: 'Artist1, Artist2',
        album: 'Test Album',
        durationMs: 180000,
        elapsedMs: 0,
        isPlaying: true,
      });
    });

    it('should clear now playing when track is null', async () => {
      await updateNowPlaying(null, false, 0);

      expect(tauriInvoke).toHaveBeenCalledWith('clear_now_playing');
    });

    it('should handle missing optional fields', async () => {
      const track = {
        id: '123',
        name: 'Test Song',
        // @ts-ignore - missing optional fields
        artists: undefined,
        // @ts-ignore
        album: undefined,
        // @ts-ignore
        duration_ms: undefined,
      };

      await updateNowPlaying(track, false, 0);

      expect(tauriInvoke).toHaveBeenCalledWith('update_now_playing', {
        title: 'Test Song',
        artist: null,
        album: null,
        durationMs: null,
        elapsedMs: 0,
        isPlaying: false,
      });
    });

    it('should handle errors gracefully', async () => {
      (tauriInvoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IPC failed'));

      // Should not throw
      await expect(updateNowPlaying(null, false, 0)).resolves.toBeUndefined();
    });
  });

  describe('clearNowPlaying', () => {
    it('should call tauriInvoke with clear_now_playing', async () => {
      await clearNowPlaying();

      expect(tauriInvoke).toHaveBeenCalledWith('clear_now_playing');
    });

    it('should handle errors gracefully', async () => {
      (tauriInvoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IPC failed'));

      // Should not throw
      await expect(clearNowPlaying()).resolves.toBeUndefined();
    });
  });
});
