import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { h } from 'preact';
import ArtistTopSongs from './ArtistTopSongs';
import type { SpotifyArtist, SpotifyTrack } from '../types';

const mockArtist: SpotifyArtist = {
  id: 'artist-1',
  name: 'Mock Artist',
  genres: ['rock'],
  followers: { total: 1000 },
  images: [],
  popularity: 50,
  uri: 'spotify:artist:artist-1',
};

const mockTracks: SpotifyTrack[] = [
  {
    id: 'track-1',
    name: 'Mock Song',
    uri: 'spotify:track:track-1',
    duration_ms: 180_000,
    artists: [mockArtist],
    album: {
      id: 'album-1',
      name: 'Mock Album',
      images: [],
      uri: 'spotify:album:album-1',
      artists: [mockArtist],
      release_date: '2024-01-01',
      total_tracks: 10,
    },
    track_number: 1,
    disc_number: 1,
    explicit: false,
    popularity: 80,
    preview_url: null,
  },
];

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function cleanup(container: HTMLElement) {
  render(null, container);
  container.remove();
}

describe('ArtistTopSongs', () => {
  it('calls onPlayUris with the track URI when a song row is clicked', () => {
    const onPlayUris = vi.fn();
    const container = createContainer();

    act(() => {
      render(
        h(ArtistTopSongs, {
          artist: mockArtist,
          topTracks: mockTracks,
          tags: ['rock'],
          onPlayUris,
        }),
        container
      );
    });

    const row = container.querySelector('.song-row');
    expect(row).not.toBeNull();

    act(() => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPlayUris).toHaveBeenCalledTimes(1);
    expect(onPlayUris).toHaveBeenCalledWith(['spotify:track:track-1']);

    cleanup(container);
  });

  it('calls onPlayUris when the play button is clicked', () => {
    const onPlayUris = vi.fn();
    const container = createContainer();

    act(() => {
      render(
        h(ArtistTopSongs, {
          artist: mockArtist,
          topTracks: mockTracks,
          tags: ['rock'],
          onPlayUris,
        }),
        container
      );
    });

    const playButton = container.querySelector('.song-play-btn');
    expect(playButton).not.toBeNull();

    act(() => {
      playButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPlayUris).toHaveBeenCalledTimes(1);
    expect(onPlayUris).toHaveBeenCalledWith(['spotify:track:track-1']);

    cleanup(container);
  });

  it('does not call onPlayUris when the track has no URI', () => {
    const onPlayUris = vi.fn();
    const container = createContainer();

    act(() => {
      render(
        h(ArtistTopSongs, {
          artist: mockArtist,
          topTracks: [{ ...mockTracks[0], uri: undefined } as SpotifyTrack],
          tags: ['rock'],
          onPlayUris,
        }),
        container
      );
    });

    const row = container.querySelector('.song-row');
    act(() => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPlayUris).not.toHaveBeenCalled();

    cleanup(container);
  });
});
