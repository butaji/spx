/**
 * Mock Spotify data and API stubs for VITE_SPX_MOCK=1 mode.
 *
 * This module is intentionally free of store imports so it can be used by
 * the API layer (lib/spotify.ts) without creating circular dependencies.
 * Store initialization in mock mode is handled by the auth hook.
 */

import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyDevice,
  SpotifyImage,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  SpotifyQueueResponse,
  SpotifySearchResults,
  SpotifyTrack,
  SpotifyUserProfile,
} from "../types";

let mockEnabled = false;

export function enableMockMode(): void {
  mockEnabled = true;
}

export function disableMockMode(): void {
  mockEnabled = false;
}

export function isMockActive(): boolean {
  return mockEnabled;
}

const MOCK_ARTIST: SpotifyArtist = {
  id: "mock-artist-id",
  name: "Mock Artist",
  genres: ["electro swing", "trip hop", "nu jazz"],
  followers: { total: 42_000 },
  images: [],
  popularity: 72,
  uri: "spotify:artist:mock-artist-id",
};

const MOCK_ALBUM_IMAGE: SpotifyImage = {
  url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzJiMmIzYiIvPjx0ZXh0IHg9IjI1NiIgeT0iMjgwIiBmb250LXNpemU9IjgwIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7imY88L3RleHQ+PC9zdmc+",
  height: 512,
  width: 512,
};

const MOCK_ALBUM: SpotifyAlbum = {
  id: "mock-album-id",
  name: "Mock Album",
  images: [MOCK_ALBUM_IMAGE],
  uri: "spotify:album:mock-album-id",
  artists: [MOCK_ARTIST],
  release_date: "2024-01-01",
  total_tracks: 10,
};

export const MOCK_TRACK: SpotifyTrack = {
  id: "mock-track-id",
  name: "Mock Song",
  uri: "spotify:track:mock-track-id",
  duration_ms: 180_000,
  artists: [MOCK_ARTIST],
  album: MOCK_ALBUM,
  track_number: 1,
  disc_number: 1,
  explicit: false,
  popularity: 85,
  preview_url: null,
};

const MOCK_QUEUE_TRACK: SpotifyTrack = {
  id: "mock-queue-track-id",
  name: "Next Mock Song",
  uri: "spotify:track:mock-queue-track-id",
  duration_ms: 200_000,
  artists: [MOCK_ARTIST],
  album: MOCK_ALBUM,
};

const MOCK_USER: SpotifyUserProfile = {
  id: "mock-user-id",
  display_name: "Mock User",
  images: [],
  email: "mock@example.com",
  country: "US",
  product: "premium",
  followers: { total: 7 },
  uri: "spotify:user:mock-user-id",
};

const MOCK_PLAYLIST: SpotifyPlaylist = {
  id: "mock-playlist-id",
  name: "My Playlist",
  description: "A mock playlist for testing",
  images: [MOCK_ALBUM_IMAGE],
  owner: {
    id: "mock-user-id",
    display_name: "Mock User",
    uri: "spotify:user:mock-user-id",
  },
  uri: "spotify:playlist:mock-playlist-id",
  tracks: { total: 12, href: "" },
};

const MOCK_DEVICES: SpotifyDevice[] = [
  {
    id: "spx-player",
    name: "SPX Player",
    type: "computer",
    is_active: true,
    is_private_session: false,
    is_restricted: false,
    supports_volume: true,
    volume_percent: 74,
  },
  {
    id: "this-computer",
    name: "This Computer",
    type: "computer",
    is_active: false,
    is_private_session: false,
    is_restricted: false,
    supports_volume: true,
    volume_percent: 74,
  },
];

let mockPlaybackState: SpotifyPlaybackState = {
  // Start paused so the progress bar stays at the expected 0:45 mark for tests.
  is_playing: false,
  shuffle_state: false,
  repeat_state: "off",
  progress_ms: 45_000,
  item: MOCK_TRACK,
  device: MOCK_DEVICES[0],
  timestamp: Date.now(),
  context: {
    type: "track",
    uri: MOCK_TRACK.uri,
  },
};

const MOCK_AUDIO_FEATURES = {
  energy: 0.72,
  danceability: 0.68,
  valence: 0.55,
  acousticness: 0.12,
};

// ─── API Stubs ───────────────────────────────────────────────────────────────

function delay(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mock = {
  getAccessToken: () => "mock-token",
  isAuthenticated: () => true,

  getPlaybackState: async (): Promise<SpotifyPlaybackState> => {
    await delay(20);
    return { ...mockPlaybackState, timestamp: Date.now() };
  },

  play: async (_deviceId?: string): Promise<void> => {
    mockPlaybackState.is_playing = true;
  },

  pause: async (_deviceId?: string): Promise<void> => {
    mockPlaybackState.is_playing = false;
  },

  nextTrack: async (): Promise<void> => {
    // Loop the same track in mock mode.
    mockPlaybackState.progress_ms = 0;
  },

  previousTrack: async (): Promise<void> => {
    mockPlaybackState.progress_ms = 0;
  },

  seek: async (positionMs: number, _deviceId?: string): Promise<void> => {
    mockPlaybackState.progress_ms = Math.max(
      0,
      Math.min(positionMs, MOCK_TRACK.duration_ms ?? 0)
    );
  },

  setVolume: async (volumePercent: number, _deviceId?: string): Promise<void> => {
    if (mockPlaybackState.device) {
      mockPlaybackState.device.volume_percent = volumePercent;
    }
    MOCK_DEVICES.forEach((d) => (d.volume_percent = volumePercent));
  },

  toggleShuffle: async (_state: boolean, _deviceId?: string): Promise<void> => {
    mockPlaybackState.shuffle_state = !mockPlaybackState.shuffle_state;
  },

  setRepeat: async (state: "off" | "track" | "context", _deviceId?: string): Promise<void> => {
    mockPlaybackState.repeat_state = state;
  },

  transferPlayback: async (deviceId: string, _play = true): Promise<void> => {
    // Update the active device in mock state so the UI reflects the transfer.
    MOCK_DEVICES.forEach((d) => {
      d.is_active = d.id === deviceId;
    });
    mockPlaybackState.device = MOCK_DEVICES.find((d) => d.id === deviceId) ?? MOCK_DEVICES[0];
  },

  playContext: async (_contextUri: string, _offset?: number, _deviceId?: string): Promise<void> => {
    mockPlaybackState.is_playing = true;
  },

  playUris: async (_uris: string[], _offset?: number, _deviceId?: string): Promise<void> => {
    mockPlaybackState.is_playing = true;
  },

  addToQueue: async (_uri: string, _deviceId?: string): Promise<boolean> => {
    return true;
  },

  getMyQueue: async (): Promise<SpotifyQueueResponse> => {
    await delay(20);
    return {
      currently_playing: MOCK_TRACK,
      queue: [MOCK_QUEUE_TRACK],
    };
  },

  getCurrentUser: async (): Promise<SpotifyUserProfile> => {
    await delay(20);
    return { ...MOCK_USER };
  },

  getUserPlaylists: async (_limit = 50, _offset = 0): Promise<{ items: SpotifyPlaylist[]; total: number }> => {
    await delay(20);
    return { items: [{ ...MOCK_PLAYLIST }], total: 1 };
  },

  getMySavedTracks: async (_limit = 50, _offset = 0): Promise<{ items: Array<{ track: SpotifyTrack }>; total: number }> => {
    await delay(20);
    return { items: [{ track: { ...MOCK_TRACK } }], total: 1 };
  },

  getMySavedAlbums: async (_limit = 50, _offset = 0): Promise<{ items: Array<{ album: SpotifyAlbum }>; total: number }> => {
    await delay(20);
    return { items: [{ album: { ...MOCK_ALBUM } }], total: 1 };
  },

  getMyTop: async (type: "artists" | "tracks", _timeRange = "medium_term", _limit = 50): Promise<SpotifyArtist[] | SpotifyTrack[]> => {
    await delay(20);
    return type === "artists" ? [{ ...MOCK_ARTIST }] : [{ ...MOCK_TRACK }];
  },

  getMyRecentlyPlayed: async (_limit = 50): Promise<{ items: Array<{ track: SpotifyTrack; played_at: string }> }> => {
    await delay(20);
    return {
      items: [
        {
          track: { ...MOCK_TRACK },
          played_at: new Date().toISOString(),
        },
      ],
    };
  },

  getMyFollowedArtists: async (_limit = 50, _after?: string): Promise<SpotifyArtist[]> => {
    await delay(20);
    return [{ ...MOCK_ARTIST }];
  },

  getNewReleases: async (_limit = 50, _offset = 0): Promise<SpotifyAlbum[]> => {
    await delay(20);
    return [{ ...MOCK_ALBUM }];
  },

  getCategories: async (_limit = 50, _offset = 0): Promise<Array<{ id: string; name: string }>> => {
    await delay(20);
    return [{ id: "mock-category", name: "Mock Category" }];
  },

  getCategoryPlaylists: async (_categoryId: string, _limit = 50, _offset = 0): Promise<SpotifyPlaylist[]> => {
    await delay(20);
    return [{ ...MOCK_PLAYLIST }];
  },

  getRecommendations: async (_options: Record<string, unknown>): Promise<{ tracks: SpotifyTrack[] }> => {
    await delay(20);
    return { tracks: [{ ...MOCK_TRACK }] };
  },

  search: async (_query: string, _types?: unknown, _limit = 50): Promise<SpotifySearchResults> => {
    await delay(30);
    return {
      tracks: {
        items: [{ ...MOCK_TRACK }],
        total: 1,
        href: "",
        limit: 50,
        offset: 0,
        next: null,
        previous: null,
      },
      albums: {
        items: [{ ...MOCK_ALBUM }],
        total: 1,
        href: "",
        limit: 50,
        offset: 0,
        next: null,
        previous: null,
      },
      artists: {
        items: [{ ...MOCK_ARTIST }],
        total: 1,
        href: "",
        limit: 50,
        offset: 0,
        next: null,
        previous: null,
      },
      playlists: {
        items: [{ ...MOCK_PLAYLIST }],
        total: 1,
        href: "",
        limit: 50,
        offset: 0,
        next: null,
        previous: null,
      },
    };
  },

  getPlaylist: async (_playlistId: string): Promise<SpotifyPlaylist> => {
    await delay(20);
    return { ...MOCK_PLAYLIST };
  },

  getPlaylistTracks: async (_playlistId: string, _limit = 100, _offset = 0): Promise<{ items: Array<{ track: SpotifyTrack }>; total: number }> => {
    await delay(20);
    return { items: [{ track: { ...MOCK_TRACK } }], total: 1 };
  },

  getAlbum: async (_albumId: string): Promise<SpotifyAlbum> => {
    await delay(20);
    return { ...MOCK_ALBUM };
  },

  getAlbumTracks: async (_albumId: string, _limit = 50, _offset = 0): Promise<{ items: SpotifyTrack[]; total: number }> => {
    await delay(20);
    return { items: [{ ...MOCK_TRACK }], total: 1 };
  },

  getAlbums: async (_ids: string[]): Promise<SpotifyAlbum[]> => {
    await delay(20);
    return [{ ...MOCK_ALBUM }];
  },

  getArtist: async (_artistId: string): Promise<SpotifyArtist> => {
    await delay(20);
    return { ...MOCK_ARTIST };
  },

  getArtistTopTracks: async (_artistId: string, _country = "US"): Promise<{ tracks: SpotifyTrack[] }> => {
    await delay(20);
    return { tracks: [{ ...MOCK_TRACK }] };
  },

  getArtistAlbums: async (_artistId: string, _options?: Record<string, unknown>): Promise<{ items: SpotifyAlbum[] }> => {
    await delay(20);
    return { items: [{ ...MOCK_ALBUM }] };
  },

  getArtistRelatedArtists: async (_artistId: string): Promise<{ artists: SpotifyArtist[] }> => {
    await delay(20);
    return { artists: [{ ...MOCK_ARTIST }] };
  },

  getArtists: async (_ids: string[]): Promise<SpotifyArtist[]> => {
    await delay(20);
    return [{ ...MOCK_ARTIST }];
  },

  getTrack: async (_trackId: string): Promise<SpotifyTrack> => {
    await delay(20);
    return { ...MOCK_TRACK };
  },

  getTracks: async (_ids: string[]): Promise<SpotifyTrack[]> => {
    await delay(20);
    return [{ ...MOCK_TRACK }];
  },

  getAudioFeatures: async (_trackId: string): Promise<typeof MOCK_AUDIO_FEATURES> => {
    await delay(20);
    return { ...MOCK_AUDIO_FEATURES };
  },

  getAudioFeaturesMultiple: async (_trackIds: string[]): Promise<{ audio_features: (typeof MOCK_AUDIO_FEATURES)[] }> => {
    await delay(20);
    return { audio_features: [{ ...MOCK_AUDIO_FEATURES }] };
  },

  getAudioAnalysis: async (_trackId: string): Promise<{ segments: unknown[] }> => {
    await delay(20);
    return { segments: [] };
  },

  getMyDevices: async (): Promise<{ devices: SpotifyDevice[] }> => {
    await delay(20);
    return { devices: MOCK_DEVICES.map((d) => ({ ...d })) };
  },

  saveTracks: async (_ids: string[]): Promise<void> => {
    await delay(20);
  },

  removeTracks: async (_ids: string[]): Promise<void> => {
    await delay(20);
  },

  checkSavedTracks: async (_ids: string[]): Promise<boolean[]> => {
    await delay(20);
    return [false];
  },

  saveAlbums: async (_ids: string[]): Promise<void> => {
    await delay(20);
  },

  removeAlbums: async (_ids: string[]): Promise<void> => {
    await delay(20);
  },

  checkSavedAlbums: async (_ids: string[]): Promise<boolean[]> => {
    await delay(20);
    return [false];
  },

  followPlaylist: async (_ownerId: string, _playlistId: string): Promise<void> => {
    await delay(20);
  },

  unfollowPlaylist: async (_ownerId: string, _playlistId: string): Promise<void> => {
    await delay(20);
  },

  followArtists: async (_artistIds: string[]): Promise<void> => {
    await delay(20);
  },

  unfollowArtists: async (_artistIds: string[]): Promise<void> => {
    await delay(20);
  },

  checkFollowingArtists: async (_artistIds: string[]): Promise<boolean[]> => {
    await delay(20);
    return [false];
  },
};
