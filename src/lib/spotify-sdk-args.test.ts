/**
 * Spotify SDK Argument Tests
 *
 * Verifies that our wrapper functions pass arguments to the official SDK
 * in the order/shape the SDK expects. Several regressions were caused by
 * passing limit/offset into the wrong parameter slots.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); }),
});

vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});

vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  }),
  subtle: { digest: vi.fn(async () => new ArrayBuffer(32)) },
});

vi.stubGlobal('fetch', vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockRejectedValue(new Error('Not in Tauri')),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

const mockSdk = {
  player: {
    getPlaybackState: vi.fn(),
    startResumePlayback: vi.fn(),
    pausePlayback: vi.fn(),
    skipToNext: vi.fn(),
    skipToPrevious: vi.fn(),
    seekToPosition: vi.fn(),
    setPlaybackVolume: vi.fn(),
    togglePlaybackShuffle: vi.fn(),
    setRepeatMode: vi.fn(),
  },
  currentUser: {
    playlists: { playlists: vi.fn() },
    savedTracks: { tracks: vi.fn() },
    savedAlbums: { albums: vi.fn() },
    topItems: vi.fn(),
    followedArtists: vi.fn(),
  },
  browse: {
    getNewReleases: vi.fn(),
    getCategories: vi.fn(),
    getPlaylistsForCategory: vi.fn(),
    recommendations: vi.fn(),
  },
  playlists: {
    getPlaylist: vi.fn(),
    getPlaylistItems: vi.fn(),
  },
  albums: {
    get: vi.fn(),
    tracks: vi.fn(),
  },
  artists: {
    get: vi.fn(),
    topTracks: vi.fn(),
    albums: vi.fn(),
    relatedArtists: vi.fn(),
  },
  search: vi.fn(),
};

vi.mock('@spotify/web-api-ts-sdk', () => ({
  SpotifyApi: {
    withAccessToken: vi.fn(() => mockSdk),
    performUserAuthorization: vi.fn(),
  },
}));

async function importSpotify() {
  return import('./spotify');
}

function setValidToken() {
  localStorageMock['spx_spotify_token'] = JSON.stringify({
    accessToken: 'test_token',
    expiresAt: Date.now() + 3600000,
  });
}

async function initSdk() {
  setValidToken();
  const { ensureValidToken } = await importSpotify();
  await ensureValidToken();
}

describe('Spotify SDK argument passing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
  });

  describe('pagination wrappers', () => {
    it('getPlaylistItems receives limit/offset in the correct slots', async () => {
      await initSdk();
      mockSdk.playlists.getPlaylistItems.mockResolvedValue({ items: [], total: 0 });
      const { getPlaylistTracks } = await importSpotify();
      await getPlaylistTracks('playlist-123', 100, 50);

      expect(mockSdk.playlists.getPlaylistItems).toHaveBeenCalledWith(
        'playlist-123',
        undefined,
        undefined,
        100,
        50,
      );
    });

    it('albums.tracks receives limit/offset in the correct slots', async () => {
      await initSdk();
      mockSdk.albums.tracks.mockResolvedValue({ items: [], total: 0 });
      const { getAlbumTracks } = await importSpotify();
      await getAlbumTracks('album-123', 25, 10);

      expect(mockSdk.albums.tracks).toHaveBeenCalledWith('album-123', undefined, 25, 10);
    });

    it('artists.albums receives limit/offset in the correct slots', async () => {
      await initSdk();
      mockSdk.artists.albums.mockResolvedValue({ items: [], total: 0 });
      const { getArtistAlbums } = await importSpotify();
      await getArtistAlbums('artist-123', { album_type: 'album', limit: 20, offset: 5 });

      expect(mockSdk.artists.albums).toHaveBeenCalledWith('artist-123', 'album', undefined, 20, 5);
    });

    it('getNewReleases receives limit/offset after the country slot', async () => {
      await initSdk();
      mockSdk.browse.getNewReleases.mockResolvedValue({ albums: { items: [] } });
      const { getNewReleases } = await importSpotify();
      await getNewReleases(10, 0);

      expect(mockSdk.browse.getNewReleases).toHaveBeenCalledWith(undefined, 10, 0);
    });

    it('getCategories receives limit/offset after country and locale slots', async () => {
      await initSdk();
      mockSdk.browse.getCategories.mockResolvedValue({ categories: { items: [] } });
      const { getCategories } = await importSpotify();
      await getCategories(10, 0);

      expect(mockSdk.browse.getCategories).toHaveBeenCalledWith(undefined, undefined, 10, 0);
    });

    it('getPlaylistsForCategory receives limit/offset after the country slot', async () => {
      await initSdk();
      mockSdk.browse.getPlaylistsForCategory.mockResolvedValue({ playlists: { items: [] } });
      const { getCategoryPlaylists } = await importSpotify();
      await getCategoryPlaylists('cat-123', 10, 0);

      expect(mockSdk.browse.getPlaylistsForCategory).toHaveBeenCalledWith('cat-123', undefined, 10, 0);
    });

    it('search receives limit after the market slot', async () => {
      await initSdk();
      mockSdk.search.mockResolvedValue({ tracks: { items: [] }, albums: { items: [] }, artists: { items: [] }, playlists: { items: [] } });
      const { search } = await importSpotify();
      await search('Daft Punk', ['track'], 5);

      expect(mockSdk.search).toHaveBeenCalledWith('Daft Punk', ['track'], undefined, 5);
    });

    it('followedArtists receives after/limit in the correct order', async () => {
      await initSdk();
      mockSdk.currentUser.followedArtists.mockResolvedValue({ artists: { items: [] } });
      const { getMyFollowedArtists } = await importSpotify();
      await getMyFollowedArtists(30, 'after-cursor');

      expect(mockSdk.currentUser.followedArtists).toHaveBeenCalledWith('after-cursor', 30);
    });
  });

  describe('playback wrappers', () => {
    it('nextTrack passes deviceId to skipToNext', async () => {
      await initSdk();
      mockSdk.player.skipToNext.mockResolvedValue(undefined);
      const { nextTrack } = await importSpotify();
      await nextTrack('device-123');

      expect(mockSdk.player.skipToNext).toHaveBeenCalledWith('device-123');
    });

    it('previousTrack passes deviceId to skipToPrevious', async () => {
      await initSdk();
      mockSdk.player.skipToPrevious.mockResolvedValue(undefined);
      const { previousTrack } = await importSpotify();
      await previousTrack('device-123');

      expect(mockSdk.player.skipToPrevious).toHaveBeenCalledWith('device-123');
    });

    it('playContext passes numeric offset as { position } object', async () => {
      await initSdk();
      mockSdk.player.startResumePlayback.mockResolvedValue(undefined);
      const { playContext } = await importSpotify();
      await playContext('spotify:album:123', 7, 'device-123');

      expect(mockSdk.player.startResumePlayback).toHaveBeenCalledWith(
        'device-123',
        'spotify:album:123',
        undefined,
        { position: 7 },
      );
    });

    it('playContext passes string offset as { uri } object', async () => {
      await initSdk();
      mockSdk.player.startResumePlayback.mockResolvedValue(undefined);
      const { playContext } = await importSpotify();
      await playContext('spotify:album:123', 'spotify:track:456', 'device-123');

      expect(mockSdk.player.startResumePlayback).toHaveBeenCalledWith(
        'device-123',
        'spotify:album:123',
        undefined,
        { uri: 'spotify:track:456' },
      );
    });

    it('playUris passes numeric offset as { position } object', async () => {
      await initSdk();
      mockSdk.player.startResumePlayback.mockResolvedValue(undefined);
      const { playUris } = await importSpotify();
      await playUris(['spotify:track:1', 'spotify:track:2'], 1, 'device-123');

      expect(mockSdk.player.startResumePlayback).toHaveBeenCalledWith(
        'device-123',
        undefined,
        ['spotify:track:1', 'spotify:track:2'],
        { position: 1 },
      );
    });
  });
});
