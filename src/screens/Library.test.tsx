import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { h } from 'preact';
import Library from './Library';
import type { SpotifyTrack } from '../types';

const mockTrack: SpotifyTrack = {
  id: 'track-1',
  name: 'Mock Song',
  uri: 'spotify:track:track-1',
  duration_ms: 180_000,
  artists: [{ id: 'artist-1', name: 'Mock Artist', uri: 'spotify:artist:artist-1' }],
  album: {
    id: 'album-1',
    name: 'Mock Album',
    images: [],
    uri: 'spotify:album:album-1',
    artists: [{ id: 'artist-1', name: 'Mock Artist', uri: 'spotify:artist:artist-1' }],
    release_date: '2024-01-01',
    total_tracks: 10,
  },
  track_number: 1,
  disc_number: 1,
  explicit: false,
  popularity: 80,
  preview_url: null,
};

vi.mock('../lib/cache', () => ({
  getCached: vi.fn(async () => null),
  setCache: vi.fn(async () => {}),
}));

vi.mock('../lib/spotify', () => ({
  getUserPlaylists: vi.fn(async () => ({ items: [], total: 0 })),
  getSavedTracks: vi.fn(async () => ({ items: [], total: 0 })),
  getSavedAlbums: vi.fn(async () => ({ items: [], total: 0 })),
  getTopTracks: vi.fn(async () => []),
}));

import { getSavedTracks, getTopTracks } from '../lib/spotify';

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function cleanup(container: HTMLElement) {
  render(null, container);
  container.remove();
}

describe('Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onPlayUris with track URI when a saved track is clicked', async () => {
    vi.mocked(getSavedTracks).mockResolvedValueOnce({
      items: [{ track: mockTrack }],
      total: 1,
    });

    const onPlayUris = vi.fn();
    const onNavigate = vi.fn();
    const container = createContainer();

    await act(async () => {
      render(
        h(Library, { onPlayUris, onNavigate }),
        container
      );
    });

    // Switch to Songs tab
    const songsTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === 'Songs'
    );
    expect(songsTab).toBeDefined();

    await act(async () => {
      songsTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Wait for the async track load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const trackRow = container.querySelector('.track');
    expect(trackRow).not.toBeNull();

    act(() => {
      trackRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPlayUris).toHaveBeenCalledTimes(1);
    expect(onPlayUris).toHaveBeenCalledWith(['spotify:track:track-1']);

    cleanup(container);
  });

  it('calls onPlayUris with track URI when a top track is clicked', async () => {
    vi.mocked(getTopTracks).mockResolvedValueOnce([mockTrack]);

    const onPlayUris = vi.fn();
    const onNavigate = vi.fn();
    const container = createContainer();

    await act(async () => {
      render(
        h(Library, { onPlayUris, onNavigate }),
        container
      );
    });

    // Switch to Top tab
    const topTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === 'Top'
    );
    expect(topTab).toBeDefined();

    await act(async () => {
      topTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const trackRow = container.querySelector('.track');
    expect(trackRow).not.toBeNull();

    act(() => {
      trackRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPlayUris).toHaveBeenCalledTimes(1);
    expect(onPlayUris).toHaveBeenCalledWith(['spotify:track:track-1']);

    cleanup(container);
  });
});
