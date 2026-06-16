import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import Search from './Search';

const mockTrack = {
  id: 'track-1',
  name: 'Mock Song',
  uri: 'spotify:track:track-1',
  duration_ms: 180_000,
  artists: [{ id: 'artist-1', name: 'Mock Artist', uri: 'spotify:artist:artist-1' }],
  album: {
    id: 'album-1',
    name: 'Mock Album',
    images: [{ url: 'https://example.com/album.jpg' }],
    uri: 'spotify:album:album-1',
  },
};

const mockArtist = {
  id: 'artist-1',
  name: 'Mock Artist',
  images: [{ url: 'https://example.com/artist.jpg' }],
  uri: 'spotify:artist:artist-1',
};

const mockAlbum = {
  id: 'album-1',
  name: 'Mock Album',
  images: [{ url: 'https://example.com/album.jpg' }],
  artists: [{ id: 'artist-1', name: 'Mock Artist', uri: 'spotify:artist:artist-1' }],
  album_type: 'album',
  release_date: '2024-01-01',
  uri: 'spotify:album:album-1',
};

const mockPlaylist = {
  id: 'playlist-1',
  name: 'Mock Playlist',
  images: [{ url: 'https://example.com/playlist.jpg' }],
  tracks: { total: 5 },
  uri: 'spotify:playlist:playlist-1',
};

vi.mock('../lib/spotify', () => ({
  search: vi.fn(),
}));

import { search } from '../lib/spotify';

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function cleanup(container: HTMLElement) {
  render(null, container);
  container.remove();
}

describe('Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search results without crashing when Spotify returns null items', async () => {
    const onPlayUris = vi.fn();
    const onPlayContext = vi.fn();
    const onNavigate = vi.fn();

    (search as ReturnType<typeof vi.fn>).mockResolvedValue({
      tracks: { items: [mockTrack, null, mockTrack] },
      artists: { items: [mockArtist, null] },
      albums: { items: [null, mockAlbum] },
      playlists: { items: [mockPlaylist, null] },
    });

    const container = createContainer();

    await act(async () => {
      render(
        h(Search, {
          onPlayUris,
          onPlayContext,
          onNavigate,
          initialQuery: 'test',
        }),
        container
      );
    });

    // Wait for the mocked search promise to resolve and state to update.
    await act(async () => new Promise((r) => setTimeout(r, 10)));

    const text = container.textContent || '';
    expect(text).toContain('Mock Song');
    expect(text).toContain('Mock Artist');
    expect(text).toContain('Mock Album');
    expect(text).toContain('Mock Playlist');

    cleanup(container);
  });
});
