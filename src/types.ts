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
  id?: string;
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
  supports_volume?: boolean;
  // Extended fields for local device merging
  isLocal?: boolean;
  localNote?: string;
  canTransfer?: boolean;
  needsWakeUp?: boolean;
  deviceIp?: string;
}

export interface LocalDevice {
  name: string;
  ip: string;
  port: number;
  id?: string;              // Spotify device ID if available
  is_active?: boolean;      // Whether this device is currently active
  canTransfer?: boolean;    // True if also a Spotify Connect device
  note?: string;            // e.g. "Wake this device to control it from SPX" for Cast-only devices
  service_type?: string;    // Which mDNS service discovered it (e.g. "_googlecast._tcp.local.")
  friendly_name?: string;   // Human-readable name from TXT records
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

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  type: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  duration_ms: number;
}

export interface SpotifyAudioAnalysis {
  meta: {
    analyzer_version: string;
    platform: string;
    detailed_status: string;
    lookup_time_utc: string;
  };
  track: {
    num_samples: number;
    duration: number;
    sample_md5: string;
    window_seconds: number;
    analysis_sample_rate: number;
    analysis_channels: number;
    end_of_fade_in: number;
    start_of_fade_out: number;
    loudness: number;
    tempo: number;
    tempo_confidence: number;
    time_signature: number;
    time_signature_confidence: number;
    key: number;
    key_confidence: number;
    mode: number;
    mode_confidence: number;
    codestring: string;
    code_version: number;
    echoprintstring: string;
    echoprint_version: number;
    syncs: string;
    rhythm_version: number;
  };
  bars: Array<{ start: number; duration: number; confidence: number }>;
  beats: Array<{ start: number; duration: number; confidence: number }>;
  sections: Array<{ start: number; duration: number; confidence: number; loudness: number; tempo: number; tempo_confidence: number; key: number; key_confidence: number; mode: number; mode_confidence: number }>;
  segments: Array<{ start: number; duration: number; confidence: number; loudness_start: number; loudness_max: number; pitches: number[]; timbre: number[] }>;
  tatums: Array<{ start: number; duration: number; confidence: number }>;
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

// ─── View & TrackInfo ─────────────────────────────────────────────────────────

export type View =
  | { type: "home" }
  | { type: "search" }
  | { type: "library"; tab?: string }
  | { type: "queue" }
  | { type: "diagnostics" }
  | { type: "playlist"; id: string; name: string }
  | { type: "album"; id: string; name: string }
  | { type: "artist"; id: string; name: string };

export interface TrackInfo {
  id: string;
  name: string;
  artist: string;
  artistIds?: string[];
  album: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  imageUrl?: string;
  uri: string;
}
