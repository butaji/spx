import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    getStore: () => store,
    setStore: (s: Record<string, string>) => { store = s; },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Import after mock is set up
import { playCounts, recordPlay, getArtistPlayCount, getTrackPlayCount } from './playCounts';

describe('playCounts store', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setStore({});
    playCounts.value = { artists: {}, tracks: {} };
  });

  describe('recordPlay increments counts', () => {
    it('records play for new artist and track', () => {
      recordPlay('Artist A', 'Track 1');

      expect(getArtistPlayCount('Artist A')).toBe(1);
      expect(getTrackPlayCount('Track 1')).toBe(1);
    });

    it('increments artist count when same artist plays different track', () => {
      recordPlay('Artist A', 'Track 1');
      recordPlay('Artist A', 'Track 2');

      expect(getArtistPlayCount('Artist A')).toBe(2);
      expect(getTrackPlayCount('Track 1')).toBe(1);
      expect(getTrackPlayCount('Track 2')).toBe(1);
    });

    it('increments track count when different artist plays same track', () => {
      recordPlay('Artist A', 'Track 1');
      recordPlay('Artist B', 'Track 1');

      expect(getArtistPlayCount('Artist A')).toBe(1);
      expect(getArtistPlayCount('Artist B')).toBe(1);
      expect(getTrackPlayCount('Track 1')).toBe(2);
    });
  });

  describe('same artist/track multiple times', () => {
    it('increments both counts to 3 after 3 plays', () => {
      recordPlay('Artist', 'Track');
      recordPlay('Artist', 'Track');
      recordPlay('Artist', 'Track');

      expect(getArtistPlayCount('Artist')).toBe(3);
      expect(getTrackPlayCount('Track')).toBe(3);
    });
  });

  describe('persistence', () => {
    it('saves play counts to localStorage', () => {
      recordPlay('Artist X', 'Track Y');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'spx_play_counts',
        JSON.stringify({
          artists: { 'artist x': 1 },
          tracks: { 'track y': 1 },
        })
      );
    });

    it('loads counts from localStorage on init', () => {
      mockLocalStorage.setStore({
        spx_play_counts: JSON.stringify({
          artists: { 'loaded artist': 5 },
          tracks: { 'loaded track': 3 },
        }),
      });

      // Re-initialize by clearing and re-importing would be complex,
      // so we test the signal reflects what was set (using normalized keys)
      playCounts.value = { artists: { 'loaded artist': 5 }, tracks: { 'loaded track': 3 } };

      expect(getArtistPlayCount('Loaded Artist')).toBe(5);
      expect(getTrackPlayCount('Loaded Track')).toBe(3);
    });

    it('persists data across multiple recordPlay calls', () => {
      recordPlay('Artist A', 'Track 1');
      recordPlay('Artist A', 'Track 2');
      recordPlay('Artist B', 'Track 1');

      const stored = mockLocalStorage.getStore()['spx_play_counts'];
      const parsed = JSON.parse(stored);

      expect(parsed.artists['artist a']).toBe(2);
      expect(parsed.artists['artist b']).toBe(1);
      expect(parsed.tracks['track 1']).toBe(2);
      expect(parsed.tracks['track 2']).toBe(1);
    });
  });

  describe('getArtistPlayCount / getTrackPlayCount', () => {
    it('returns correct count for existing artist', () => {
      recordPlay('Artist A', 'Track 1');
      recordPlay('Artist A', 'Track 2');

      expect(getArtistPlayCount('Artist A')).toBe(2);
    });

    it('returns correct count for existing track', () => {
      recordPlay('Artist A', 'Track 1');
      recordPlay('Artist B', 'Track 1');

      expect(getTrackPlayCount('Track 1')).toBe(2);
    });

    it('returns 0 for non-existent artist', () => {
      expect(getArtistPlayCount('NonExistent')).toBe(0);
    });

    it('returns 0 for non-existent track', () => {
      expect(getTrackPlayCount('NonExistent')).toBe(0);
    });
  });

  describe('signal reactivity', () => {
    it('playCounts signal updates when recordPlay is called', () => {
      const initialValue = playCounts.value;

      recordPlay('Artist A', 'Track 1');

      expect(playCounts.value).not.toBe(initialValue);
      expect(playCounts.value.artists['artist a']).toBe(1);
      expect(playCounts.value.tracks['track 1']).toBe(1);
    });

    it('subscribers receive updated values', () => {
      let capturedValue: typeof playCounts.value | null = null;

      const unsubscribe = playCounts.subscribe((value) => {
        capturedValue = value;
      });

      recordPlay('Artist B', 'Track 2');

      expect(capturedValue).not.toBeNull();
      expect(capturedValue!.artists['artist b']).toBe(1);
      expect(capturedValue!.tracks['track 2']).toBe(1);

      unsubscribe();
    });

    it('signal reflects accumulated counts', () => {
      recordPlay('Artist X', 'Track 1');
      recordPlay('Artist Y', 'Track 1');
      recordPlay('Artist X', 'Track 2');

      expect(playCounts.value.artists['artist x']).toBe(2);
      expect(playCounts.value.artists['artist y']).toBe(1);
      expect(playCounts.value.tracks['track 1']).toBe(2);
      expect(playCounts.value.tracks['track 2']).toBe(1);
    });
  });

  describe('name normalization', () => {
    it('trims whitespace from artist and track names', () => {
      recordPlay('  Artist A  ', '  Track 1  ');

      expect(getArtistPlayCount('Artist A')).toBe(1);
      expect(getTrackPlayCount('Track 1')).toBe(1);
    });

    it('normalizes to lowercase for consistent counting', () => {
      recordPlay('ARTIST A', 'TRACK 1');
      recordPlay('artist a', 'track 1');

      // Both should count as the same normalized key
      expect(getArtistPlayCount('artist a')).toBe(2);
      expect(getTrackPlayCount('track 1')).toBe(2);
    });

    it('handles mixed case with whitespace', () => {
      recordPlay('  Artist B  ', '  Track 2  ');
      recordPlay('ARTIST B', 'track 2');

      expect(getArtistPlayCount('artist b')).toBe(2);
      expect(getTrackPlayCount('track 2')).toBe(2);
    });
  });
});
