/**
 * Content store unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); }),
});

const mocks = vi.hoisted(() => ({
  getRecentlyPlayedTracks: vi.fn(),
  getUserPlaylists: vi.fn(),
  getTopTracks: vi.fn(),
  getBrowseCategories: vi.fn(),
  getNewReleases: vi.fn(),
  getCategoryPlaylists: vi.fn(),
}));

vi.mock('../lib/spotify', () => ({
  getUserPlaylists: mocks.getUserPlaylists,
  getQueue: vi.fn(),
  getArtist: vi.fn(),
  getArtistTopTracks: vi.fn(),
  getArtistAlbums: vi.fn(),
  getRecentlyPlayedTracks: mocks.getRecentlyPlayedTracks,
  getPlaylist: vi.fn(),
  getBrowseCategories: mocks.getBrowseCategories,
  getCategoryPlaylists: mocks.getCategoryPlaylists,
  getNewReleases: mocks.getNewReleases,
  getTopTracks: mocks.getTopTracks,
  getTopArtists: vi.fn(),
}));

vi.mock('../lib/cache', () => ({
  getCached: vi.fn(() => null),
  setCache: vi.fn(),
  isCacheFresh: vi.fn(() => false),
}));

import { loadRecentContainers, lastPlayedTrack, recentContainers } from './content';

describe('loadRecentContainers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
    lastPlayedTrack.value = null;
    recentContainers.value = [];
  });

  it('populates lastPlayedTrack with id from recently played items', async () => {
    mocks.getRecentlyPlayedTracks.mockResolvedValue({
      items: [
        {
          track: {
            id: 'track-123',
            name: 'Last Song',
            uri: 'spotify:track:track-123',
            artists: [{ id: 'artist-1', name: 'Artist One' }],
            album: {
              id: 'album-1',
              name: 'Album One',
              images: [{ url: 'https://example.com/image.jpg' }],
            },
            duration_ms: 200000,
          },
          played_at: '2024-01-01T00:00:00Z',
        },
      ],
    });

    mocks.getTopTracks.mockResolvedValue([]);
    mocks.getUserPlaylists.mockResolvedValue({ items: [] });

    await loadRecentContainers();

    expect(lastPlayedTrack.value).not.toBeNull();
    expect(lastPlayedTrack.value?.id).toBe('track-123');
    expect(lastPlayedTrack.value?.name).toBe('Last Song');
    expect(lastPlayedTrack.value?.artistName).toBe('Artist One');
  });
});
