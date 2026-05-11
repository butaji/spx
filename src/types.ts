// ─── Core Types ─────────────────────────────────────────────────────────────

export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  followers?: {
    total: number;
  };
  images?: SpotifyImage[];
  popularity?: number;
  uri?: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images?: SpotifyImage[];
  uri?: string;
  artists?: SpotifyArtist[];
  release_date?: string;
  tracks?: {
    items: SpotifyTrack[];
    total?: number;
  };
  album_type?: string;
  total_tracks?: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms?: number;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  images?: SpotifyImage[];
  track_number?: number;
  disc_number?: number;
  explicit?: boolean;
  popularity?: number;
  preview_url?: string | null;
}

export interface SpotifyDevice {
  id?: string;
  name?: string;
  volume_percent?: number;
  type?: string;
  is_active?: boolean;
  is_private_session?: boolean;
  is_restricted?: boolean;
}

export interface SpotifyPlaybackState {
  is_playing?: boolean;
  shuffle_state?: boolean;
  repeat_state?: "off" | "context" | "track";
  progress_ms?: number;
  item?: SpotifyTrack;
  device?: SpotifyDevice;
  timestamp?: number;
  context?: {
    type?: string;
    href?: string;
    external_urls?: { spotify?: string };
    uri?: string;
  };
}

export interface SimplifiedPlaylist {
  id: string;
  name: string;
  description?: string | null;
  images?: SpotifyImage[];
  owner?: {
    id?: string;
    display_name?: string;
    href?: string;
    uri?: string;
    external_urls?: { spotify?: string };
  };
  uri?: string;
  tracks?: {
    total?: number;
    href?: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string | null;
  images?: SpotifyImage[];
  owner?: {
    id?: string;
    display_name?: string;
    href?: string;
    uri?: string;
    external_urls?: { spotify?: string };
  };
  uri?: string;
  tracks?: {
    total?: number;
    href?: string;
  };
  collaborative?: boolean;
  snapshot_id?: string;
  primary_color?: string | null;
  public?: boolean | null;
  followed?: boolean;
}

export interface SpotifyPlaylistItem {
  added_at?: string;
  added_by?: {
    id?: string;
    href?: string;
    uri?: string;
    external_urls?: { spotify?: string };
  };
  is_local?: boolean;
  track?: SpotifyTrack | null;
}

export interface SpotifySearchResults {
  tracks?: {
    items: SpotifyTrack[];
    total?: number;
    href?: string;
    limit?: number;
    offset?: number;
    next?: string | null;
    previous?: string | null;
  };
  albums?: {
    items: SpotifyAlbum[];
    total?: number;
    href?: string;
    limit?: number;
    offset?: number;
    next?: string | null;
    previous?: string | null;
  };
  artists?: {
    items: SpotifyArtist[];
    total?: number;
    href?: string;
    limit?: number;
    offset?: number;
    next?: string | null;
    previous?: string | null;
  };
  playlists?: {
    items: SpotifyPlaylist[];
    total?: number;
    href?: string;
    limit?: number;
    offset?: number;
    next?: string | null;
    previous?: string | null;
  };
}

export interface SpotifyCategory {
  id: string;
  name: string;
  icons?: SpotifyImage[];
  href?: string;
}

export interface SpotifyFeaturedPlaylists {
  message?: string;
  playlists?: {
    items: SpotifyPlaylist[];
    href?: string;
    limit?: number;
    next?: string | null;
    offset?: number;
    previous?: string | null;
    total?: number;
  };
}

export interface SpotifyUserProfile {
  id?: string;
  display_name?: string;
  images?: SpotifyImage[];
  email?: string;
  country?: string;
  product?: string;
  followers?: {
    total?: number;
    href?: string;
  };
  external_urls?: { spotify?: string };
  href?: string;
  uri?: string;
  explicit_content?: {
    filter_enabled?: boolean;
    filter_locked?: boolean;
  };
}

export interface SpotifyQueueResponse {
  currently_playing?: SpotifyTrack | null;
  queue?: SpotifyTrack[];
}

export interface SpotifyDeviceList {
  devices?: SpotifyDevice[];
}

export interface SpotifySavedTracks {
  items?: {
    added_at?: string;
    track?: SpotifyTrack | null;
  }[];
  total?: number;
  href?: string;
  limit?: number;
  offset?: number;
  next?: string | null;
  previous?: string | null;
}

export interface SpotifySavedAlbums {
  items?: {
    added_at?: string;
    album?: SpotifyAlbum | null;
  }[];
  total?: number;
  href?: string;
  limit?: number;
  offset?: number;
  next?: string | null;
  previous?: string | null;
}

export interface SpotifyUserPlaylists {
  items?: SpotifyPlaylist[];
  total?: number;
  href?: string;
  limit?: number;
  offset?: number;
  next?: string | null;
  previous?: string | null;
}

export interface SpotifyArtistTopTracks {
  tracks?: SpotifyTrack[];
}

export interface SpotifyAlbumOrArtist {
  id?: string;
  name?: string;
  images?: SpotifyImage[];
  uri?: string;
  artists?: SpotifyArtist[];
  release_date?: string;
  tracks?: {
    items: SpotifyTrack[];
    total?: number;
  };
}

// ─── API Error Types ─────────────────────────────────────────────────────────

export interface SpotifyAPIError {
  error?: {
    status?: number;
    message?: string;
    reason?: string;
  };
}

export type SpotifyError = SpotifyAPIError | string | unknown;
