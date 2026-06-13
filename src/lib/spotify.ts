import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";

/** Spotify actually returns `scope` in the token response, but the SDK type omits it. */
interface AccessTokenWithScope extends AccessToken {
  scope?: string;
}

/** Audio features response */
interface AudioFeaturesResponse {
  id: string;
  danceability: number;
  energy: number;
  valence: number;
  acousticness: number;
  tempo: number;
  loudness: number;
  speechiness: number;
  instrumentalness: number;
  liveness: number;
  key: number;
  mode: number;
  time_signature: number;
  duration_ms: number;
  type: string;
  uri: string;
  track_href: string;
  analysis_url: string;
}

/** Audio analysis response */
interface AudioAnalysisResponse {
  bars: Array<{ start: number; duration: number; confidence: number }>;
  beats: Array<{ start: number; duration: number; confidence: number }>;
  sections: Array<{ start: number; duration: number; loudness: number; tempo: number; key: number; mode: number; time_signature: number }>;
  segments: Array<{ start: number; duration: number; loudness: number; tempo: number; tempo_confidence: number; key: number; key_confidence: number; mode: number; mode_confidence: number }>;
  track: { duration: number; sample_end: number; sample_start: number; fade_in: number; fade_out: number; };
}

import { invoke } from "@tauri-apps/api/core";
import { load, type Store } from '@tauri-apps/plugin-store';
import type { LocalDevice, SpotifyArtist, SpotifyTrack } from "../types";
import { withRetry } from "./retry";

/**
 * Parse a Spotify API error response into a meaningful Error.
 * Handles both structured JSON errors and raw text responses.
 */
function parseSpotifyError(response: Response, text: string, context: string = 'Request'): never {
  try {
    const data = JSON.parse(text);
    if (data?.error?.message) {
      throw new Error(`${context} failed: ${data.error.message}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(`${context} failed:`)) {
      throw e;
    }
  }
  throw new Error(text || `${context} failed: ${response.status}`);
}

interface SpotifyFetchOptions extends RequestInit {
  context?: string;
  skipRetry?: boolean;
}

/**
 * Unified fetch helper for Spotify Web API.
 * Handles auth, retry, empty 204 responses, JSON parsing, and error formatting.
 */
async function spotifyFetch(endpoint: string, options: SpotifyFetchOptions = {}): Promise<any> {
  if (isMockMode()) return;
  let token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;
  const { context, skipRetry, ...fetchOptions } = options;

  const makeRequest = async (authToken: string): Promise<Response> => {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...fetchOptions.headers,
      },
    });

    // Let 401 bubble up for special handling (token refresh)
    if (response.status === 401) {
      const err = new Error('Unauthorized') as any;
      err.status = 401;
      throw err;
    }

    // Throw on other HTTP errors so withRetry can handle 429/5xx
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`) as any;
      err.status = response.status;
      err.response = response;
      throw err;
    }

    return response;
  };

  let response: Response;

  try {
    const doFetch = () => makeRequest(token!);
    response = skipRetry ? await doFetch() : await withRetry(doFetch);
  } catch (error: any) {
    // Token expired — attempt refresh once and retry
    if (error?.status === 401) {
      const stored = await loadToken();
      if (stored?.refresh_token) {
        const refreshed = await refreshAccessToken(stored.refresh_token);
        if (refreshed) {
          token = getAccessToken();
          response = await makeRequest(token!);
        } else {
          await clearToken();
          throw new Error('Session expired. Please sign in again.');
        }
      } else {
        await clearToken();
        throw new Error('Session expired. Please sign in again.');
      }
    } else {
      throw error;
    }
  }

  if (response.status === 204) return;

  const text = await response.text();
  if (!text) return;

  try {
    const data = JSON.parse(text);
    await recordFetch(url, { method: fetchOptions.method || 'GET', body: fetchOptions.body }, response, data);
    return data;
  } catch {
    if (response.ok) return;
    parseSpotifyError(response, text, context || 'Request');
  }
}

const TOKEN_STORAGE_KEY = 'spx_spotify_token';
const STORE_PATH = 'spotify-auth.bin';

// Recording config
const RECORD_API = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_SPX_RECORD === '1';


const DEBUG = import.meta.env.DEV;
function debug(...args: any[]) { if (DEBUG) console.log(...args); }

async function recordFetch(url: string, options: any, response: Response, data: any) {
  if (!RECORD_API) return;
  
  const endpoint = url.replace('https://api.spotify.com/v1', '');
  const filename = endpoint.replace(/\//g, '_').replace(/\?/g, '_') + '.json';
  
  const recording = {
    timestamp: new Date().toISOString(),
    request: { url, method: options.method || 'GET', body: options.body },
    response: { status: response.status, body: data }
  };
  
  // Save via Tauri FS or console for manual extraction
  debug(`[API_RECORD] ${filename}:`, JSON.stringify(recording, null, 2).slice(0, 300));
}

let _store: Store | null = null;
let _tokenCache: (AccessTokenWithScope & { expires_at?: number }) | null = null;

async function getStore(): Promise<Store> {
  if (_store) return _store;
  _store = await load(STORE_PATH);
  return _store;
}

let mockModeChecked = false;
let mockModeValue = false;

export async function checkMockMode(): Promise<boolean> {
  if (mockModeChecked) return mockModeValue;
  try {
    mockModeValue = await invoke<boolean>("is_mock_mode");
  } catch (e) {
    // Fallback to env var (for web/non-Tauri)
    mockModeValue = typeof import.meta.env !== 'undefined' && 
      import.meta.env.VITE_SPX_MOCK === '1';
  }
  mockModeChecked = true;
  return mockModeValue;
}

function isMockMode(): boolean {
  return mockModeValue;
}

// Mock data
const mockTrack = {
  id: "mock-track-1",
  name: "Mock Song",
  artists: [{ name: "Mock Artist", id: "mock-artist-1" }],
  album: { name: "Mock Album", images: [{ url: "" }] },
  duration_ms: 180000,
  uri: "spotify:track:mock",
};

let mockPlaybackState = {
  item: mockTrack,
  progress_ms: 45000,
  is_playing: true,
  shuffle_state: false,
  repeat_state: "off",
  device: {
    id: "mock-device",
    name: "This Computer",
    type: "computer",
    volume_percent: 74,
    is_active: true,
    is_private_session: false,
    is_restricted: false,
  },
};

const mockUser = {
  display_name: "Mock User",
  images: [{ url: "" }],
};

const mockPlaylists = {
  items: [
    { id: "mock-pl-1", name: "My Playlist 1", images: [{ url: "" }], tracks: { total: 10 }, owner: { display_name: "Mock User" } },
    { id: "mock-pl-2", name: "My Playlist 2", images: [{ url: "" }], tracks: { total: 15 }, owner: { display_name: "Mock User" } },
  ],
};



const mockQueue = {
  queue: [
    { id: "mock-q-1", name: "Next Song 1", artists: [{ name: "Artist 1" }], album: { images: [{ url: "" }] }, duration_ms: 200000 },
    { id: "mock-q-2", name: "Next Song 2", artists: [{ name: "Artist 2" }], album: { images: [{ url: "" }] }, duration_ms: 210000 },
  ],
};

const mockDevices = {
  devices: [
    { id: "mock-device", name: "This Computer", type: "computer", volume_percent: 74, is_active: true, is_private_session: false, is_restricted: false },
    { id: "mock-speaker", name: "Living Room Speaker", type: "speaker", volume_percent: 50, is_active: false, is_private_session: false, is_restricted: false },
  ],
};

const mockArtist = {
  id: "mock-artist",
  name: "Mock Artist",
  genres: ["electronic", "trip hop"],
  followers: { total: 1234 },
  images: [{ url: "" }],
  popularity: 75,
};

const mockArtistTopTracks = {
  tracks: [
    { id: "mock-track-1", name: "Popular Song 1", uri: "spotify:track:mock1", album: { name: "Album 1", images: [{ url: "" }] }, duration_ms: 180000 },
    { id: "mock-track-2", name: "Popular Song 2", uri: "spotify:track:mock2", album: { name: "Album 2", images: [{ url: "" }] }, duration_ms: 200000 },
  ]
};

const mockAlbum = {
  id: "mock-album",
  name: "Mock Album",
  artists: [{ name: "Mock Artist", id: "mock-artist" }],
  images: [{ url: "" }],
  tracks: { items: [] },
  album_type: "album",
  release_date: "2024-01-01",
};

const mockSearch = {
  tracks: { items: [] },
  albums: { items: [] },
  artists: { items: [] },
  playlists: { items: [] },
};

const REDIRECT_URI = "http://127.0.0.1:1422/callback";

/** Scopes we request. If a stored token is missing any of these, force re-auth. */
const REQUIRED_SCOPES = [
  'streaming',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-read-private',
  'user-library-read',
  'user-library-modify',
  'user-top-read',
  'user-follow-read',
];

let clientId: string | null = null;

async function getClientId(): Promise<string> {
  debug("Getting Spotify client ID...");
  if (clientId) return clientId;
  clientId = await invoke<string>("get_spotify_client_id");
  debug("Resolved client ID:", clientId);
  return clientId;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Auth state
let accessToken: string | null = null;
let tokenVerifier: string | null = null;
let spotify: SpotifyApi | null = null;

async function saveToken(token: AccessToken) {
  try {
    const toStore = {
      ...token,
      expires_at: Date.now() + (token.expires_in * 1000) - 60000
    };
    _tokenCache = toStore;
    accessToken = token.access_token;
    const store = await getStore();
    await store.set(TOKEN_STORAGE_KEY, toStore);
    await store.save(); // Force flush to disk
    // Verify the save worked
    const verify = await store.get(TOKEN_STORAGE_KEY);
    if (verify) {
      // persistence verified
    } else {
      console.error("saveToken: WARNING - data not found after save!");
    }
  } catch (e) {
    console.error('Failed to save token:', e);
  }
}

async function loadToken(): Promise<(AccessTokenWithScope & { expires_at?: number }) | null> {
  if (_tokenCache) {
    accessToken = _tokenCache.access_token;
    return _tokenCache;
  }
  try {
    const store = await getStore();
    const stored = await store.get<AccessTokenWithScope & { expires_at?: number }>(TOKEN_STORAGE_KEY);
    if (stored) {
      _tokenCache = stored;
      accessToken = stored.access_token;
      return stored;
    }
  } catch (e) {
    console.error('Failed to load token:', e);
  }
  return null;
}

export async function clearToken() {
  try {
    _tokenCache = null;
    accessToken = null;
    const store = await getStore();
    await store.delete(TOKEN_STORAGE_KEY);
    await store.save(); // Explicit save to disk
  } catch (e) {
    console.error('Failed to clear token:', e);
  }
}

export async function startAuthFlow(): Promise<void> {
  debug("Starting auth flow...");
  // Start callback server in background
  const serverPromise = invoke<[string, string] | null>("start_callback_server");

  const id = await getClientId();
  tokenVerifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(tokenVerifier);
  const state = generateCodeVerifier().slice(0, 16);
  sessionStorage.setItem('spx_oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    scope: 'user-read-recently-played streaming user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-read-private user-library-read user-library-modify user-top-read user-follow-read',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  // Open in browser using Tauri shell
  const { open } = await import('@tauri-apps/plugin-shell');
  await open(authUrl);

  const result = await serverPromise;
  if (!result) {
    throw new Error("Auth timeout or cancelled");
  }

  const [code, returnedState] = result;
  const expectedState = sessionStorage.getItem('spx_oauth_state');
  sessionStorage.removeItem('spx_oauth_state');
  if (expectedState && returnedState !== expectedState) {
    throw new Error('OAuth state mismatch — possible CSRF attack');
  }
  await exchangeCode(code);
}

export async function exchangeCode(code: string): Promise<boolean> {
  if (!tokenVerifier) throw new Error("No verifier available");

  const id = await getClientId();
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: id,
      code_verifier: tokenVerifier,
    }),
  });

  if (!response.ok) {
    try {
      const errorData = JSON.parse(await response.text());
      throw new Error(errorData.error?.message || `Token exchange failed: ${response.status}`);
    } catch (e: any) {
      if (e.message && !e.message.includes(response.status.toString())) throw e;
      throw new Error(`Token exchange failed: HTTP ${response.status}`);
    }
  }

  const responseText = await response.text();
  
  let data: AccessTokenWithScope;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse token response as JSON:", responseText);
    throw new Error('Invalid token response from Spotify');
  }
  
  accessToken = data.access_token;

  // Save token for session persistence
  await saveToken(data);

  // Validate scopes
  const grantedScopes = (data.scope ?? '').split(' ').filter(Boolean);
  const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s));
  if (missingScopes.length > 0) {
    console.warn('[Auth] Token missing scopes:', missingScopes.join(', '));
    await clearToken();
    return false;
  }

  // Create SDK instance with token
  const clientId = await getClientId();
  spotify = SpotifyApi.withAccessToken(clientId as string, data);

  return true;
}

async function refreshAccessToken(refreshToken: string): Promise<boolean> {
  try {
    const clientId = await getClientId();
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        // Auth failure — token is invalid/expired, must re-auth
        const err = new Error(`Token refresh failed: HTTP ${status}`) as Error & { status: number; authError: true };
        err.status = status;
        err.authError = true;
        throw err;
      }
      if (status >= 500) {
        // Server error — Spotify is having issues, don't clear token
        const err = new Error(`Token refresh failed: HTTP ${status}`) as Error & { status: number; serverError: true };
        err.status = status;
        err.serverError = true;
        throw err;
      }
      // 4xx other than 401/403 — treat as auth failure
      const err = new Error(`Token refresh failed: HTTP ${status}`) as Error & { status: number; authError: true };
      err.status = status;
      err.authError = true;
      throw err;
    }

    const data = await response.json();
    if (!data.access_token) {
      console.error("No access_token in refresh response");
      return false;
    }

    // Preserve old refresh_token if Spotify didn't return a new one
    if (!data.refresh_token) {
      data.refresh_token = refreshToken;
    }

    accessToken = data.access_token;
    await saveToken(data);
    spotify = SpotifyApi.withAccessToken(clientId as string, data);
    return true;
  } catch (e: any) {
    console.error("Failed to refresh token:", e);
    // Tag as network error if not already tagged
    if (!e?.serverError && !e?.authError) {
      e.networkError = true;
    }
    throw e;
  }
}

export async function restoreSession(): Promise<boolean> {
  const token = await loadToken();
  if (!token?.access_token) {
    return false;
  }

  // Validate scopes
  const grantedScopes = (token.scope ?? '').split(' ').filter(Boolean);
  const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s));
  if (missingScopes.length > 0) {
    console.warn('[Auth] Stored token missing scopes:', missingScopes.join(', '));
    await clearToken();
    return false;
  }

  // Check if token is expired or about to expire
  const isExpired = token.expires_at ? Date.now() > token.expires_at : true;

  if (isExpired && token.refresh_token) {
    try {
      await refreshAccessToken(token.refresh_token);
      return true;
    } catch (e: any) {
      console.error("Token refresh failed:", e);
      // If refresh fails for ANY reason (401, 403, 500, network), the token
      // is unusable. Clear it and force re-authentication.
      await clearToken();
      return false;
    }
  }

  if (isExpired && !token.refresh_token) {
    await clearToken();
    return false;
  }

  accessToken = token.access_token;

  try {
    const clientId = await getClientId();
    spotify = SpotifyApi.withAccessToken(clientId as string, token);
    return true;
  } catch (e) {
    console.error("Failed to restore session:", e);
    await clearToken();
    return false;
  }
}

export async function handleCallbackUrl(url: string): Promise<boolean> {
  // Handle both com.spx.app://callback?code=xxx and http://callback?code=xxx formats
  const normalizedUrl = url.replace('com.spx.app://callback', 'http://callback');
  const urlObj = new URL(normalizedUrl);
  const code = urlObj.searchParams.get('code');
  const error = urlObj.searchParams.get('error');

  if (error) {
    throw new Error(`Spotify auth error: ${error}`);
  }

  if (!code || !tokenVerifier) {
    throw new Error('No authorization code found');
  }

  return exchangeCode(code);
}

export async function isAuthenticated(): Promise<boolean> {
  await checkMockMode(); // Ensure mock mode is determined first
  if (mockModeValue) return true;
  if (!!accessToken && !!spotify) return true;
  // Check if we have a stored token that could be restored
  const token = await loadToken();
  return !!token?.access_token;
}

export async function logout() {
  accessToken = null;
  spotify = null;
  tokenVerifier = null;
  await clearToken();

  // Stop polling and disconnect player
  try {
    const { stopPlaybackPolling } = await import('../stores/playback');
    stopPlaybackPolling();
  } catch (e) {
    console.error('Failed to stop polling on logout:', e);
  }

  try {
    const { disconnectPlayer } = await import('./playback');
    await disconnectPlayer();
  } catch (e) {
    console.error('Failed to disconnect player on logout:', e);
  }

  // Clear all stores
  try {
    const { clearStore } = await import('../stores/spotify');
    clearStore();
  } catch (e) {
    console.error('Failed to clear store on logout:', e);
  }

  try {
    const { clearDeviceSelection } = await import('../stores/devices');
    clearDeviceSelection();
  } catch (e) {
    console.error('Failed to clear device selection on logout:', e);
  }

  // Clear cached data
  try {
    const { clearCache } = await import('./cache');
    await clearCache();
  } catch (e) {
    console.error('Failed to clear cache on logout:', e);
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

// All API functions use getSpotifyApi()
function getSpotifyApi(): SpotifyApi {
  if (!spotify) {
    throw new Error('Not authenticated');
  }
  return spotify;
}

/**
 * Refresh the access token if it has expired.
 * Call this before SDK-based API calls to avoid 401 errors.
 */
export async function ensureTokenFresh(): Promise<void> {
  if (isMockMode()) return;
  const token = await loadToken();
  if (!token) return;
  const isExpired = token.expires_at ? Date.now() > token.expires_at : true;
  if (isExpired && token.refresh_token) {
    const refreshed = await refreshAccessToken(token.refresh_token);
    if (!refreshed) {
      throw new Error('Session expired. Please sign in again.');
    }
  }
}

export async function getPlaybackState() {
  if (isMockMode()) return mockPlaybackState;
  await ensureTokenFresh();
  return getSpotifyApi().player.getPlaybackState();
}

export async function play(deviceId?: string) {
  if (isMockMode()) {
    mockPlaybackState.is_playing = true;
    return;
  }
  return spotifyFetch('/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ''), {
    method: 'PUT',
    context: 'Play',
  });
}

export async function pause() {
  if (isMockMode()) {
    mockPlaybackState.is_playing = false;
    return;
  }
  return spotifyFetch('/me/player/pause', {
    method: 'PUT',
    context: 'Pause',
  });
}

export async function next() {
  if (isMockMode()) {
    mockPlaybackState.progress_ms = 0;
    mockPlaybackState.is_playing = true;
    return;
  }
  return spotifyFetch('/me/player/next', {
    method: 'POST',
    context: 'Skip next',
  });
}

export async function previous() {
  if (isMockMode()) {
    mockPlaybackState.progress_ms = 0;
    mockPlaybackState.is_playing = true;
    return;
  }
  return spotifyFetch('/me/player/previous', {
    method: 'POST',
    context: 'Skip previous',
  });
}

export async function seek(positionMs: number) {
  if (isMockMode()) return;
  return spotifyFetch(`/me/player/seek?position_ms=${positionMs}`, {
    method: 'PUT',
    context: 'Seek',
  });
}

export async function setVolume(volumePercent: number) {
  if (isMockMode()) return;
  return spotifyFetch(`/me/player/volume?volume_percent=${volumePercent}`, {
    method: 'PUT',
    context: 'SetVolume',
  });
}

export async function getAvailableDevices() {
  if (isMockMode()) return mockDevices;
  return getSpotifyApi().player.getAvailableDevices();
}

export async function transferPlayback(deviceId: string, play?: boolean) {
  if (isMockMode()) return;
  return spotifyFetch('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: play ?? true }),
    context: 'TransferPlayback',
  });
}

export async function getQueue() {
  if (isMockMode()) return mockQueue;
  await ensureTokenFresh();
  return getSpotifyApi().player.getUsersQueue();
}

export async function getRecentlyPlayedTracks(limit?: number) {
  if (isMockMode()) return { items: [] };
  await ensureTokenFresh();
  return getSpotifyApi().player.getRecentlyPlayedTracks((limit ?? 50) as 50);
}

export async function search(query: string) {
  if (isMockMode()) return mockSearch;
  await ensureTokenFresh();
  return getSpotifyApi().search(query, ["track", "album", "artist", "playlist"]);
}

export async function getUserPlaylists() {
  if (isMockMode()) return mockPlaylists;
  await ensureTokenFresh();
  return getSpotifyApi().currentUser.playlists.playlists();
}

export async function getPlaylistTracks(playlistId: string, limit?: number, offset?: number) {
  if (isMockMode()) {
    return { items: [{ track: mockPlaybackState.item }], total: 1, offset: offset ?? 0, limit: limit ?? 20 };
  }
  return getSpotifyApi().playlists.getPlaylistItems(playlistId);
}

export async function getSavedTracks(limit?: number, offset?: number) {
  if (isMockMode()) {
    return { items: [{ track: mockPlaybackState.item }], total: 1, offset: offset ?? 0, limit: limit ?? 20 };
  }
  return getSpotifyApi().currentUser.tracks.savedTracks();
}

export async function getSavedAlbums(limit?: number, offset?: number) {
  if (isMockMode()) {
    return { items: [{ album: mockAlbum }], total: 1, offset: offset ?? 0, limit: limit ?? 20 };
  }
  return getSpotifyApi().currentUser.albums.savedAlbums();
}

/**
 * Get the current user's followed artists.
 * @param limit - Number of artists to return (default 20, max 50)
 * @see https://developer.spotify.com/documentation/web-api/reference/get-followed
 */
export async function getFollowedArtists(
  limit: number = 20
): Promise<SpotifyArtist[]> {
  if (isMockMode()) return [mockArtist];

  const data = await spotifyFetch(`/me/following?type=artist&limit=${Math.min(limit, 50)}`, {
    context: 'Followed artists',
  });

  return (data.artists?.items || []).map((artist: any) => ({
    id: artist.id,
    name: artist.name,
    uri: artist.uri,
    images: artist.images,
    genres: artist.genres,
    popularity: artist.popularity,
    followers: artist.followers?.total,
  })) as SpotifyArtist[];
}

export async function getUserProfile() {
  if (isMockMode()) return mockUser;
  await ensureTokenFresh();
  return getSpotifyApi().currentUser.profile();
}

export async function getAlbum(albumId: string) {
  if (isMockMode()) return mockAlbum;
  await ensureTokenFresh();
  return getSpotifyApi().albums.get(albumId);
}

export async function getArtist(artistId: string) {
  if (isMockMode()) return mockArtist;
  await ensureTokenFresh();
  return getSpotifyApi().artists.get(artistId);
}

export async function getArtistTopTracks(artistId: string) {
  if (isMockMode()) return mockArtistTopTracks;
  await ensureTokenFresh();
  return getSpotifyApi().artists.topTracks(artistId, "US");
}

export async function getTopArtists(
  limit: number = 20,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term'
): Promise<SpotifyArtist[]> {
  if (isMockMode()) return [];

  const data = await spotifyFetch(`/me/top/artists?limit=${limit}&time_range=${timeRange}`, {
    context: 'Top artists',
  });

  return (data.items || []).map((artist: any) => ({
    id: artist.id,
    name: artist.name,
    uri: artist.uri,
    images: artist.images,
    genres: artist.genres,
    popularity: artist.popularity,
    followers: artist.followers?.total,
  })) as SpotifyArtist[];
}

/**
 * Get the current user's top tracks.
 * @param limit - Number of tracks to return (default 20, max 50)
 * @param timeRange - Over what time period to fetch top tracks: short_term (~4 weeks), medium_term (~6 months), long_term (~1 year)
 * @see https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 */
export async function getTopTracks(
  limit: number = 20,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term'
): Promise<SpotifyTrack[]> {
  if (isMockMode()) return [];

  const data = await spotifyFetch(`/me/top/tracks?limit=${limit}&time_range=${timeRange}`, {
    context: 'GetTopTracks',
  });

  return (data.items || []).map((track: any) => ({
    id: track.id,
    name: track.name,
    uri: track.uri,
    duration_ms: track.duration_ms,
    artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })),
    album: track.album ? {
      id: track.album.id,
      name: track.album.name,
      images: track.album.images,
      release_date: track.album.release_date,
    } : undefined,
    images: track.album?.images,
    track_number: track.track_number,
    disc_number: track.disc_number,
    explicit: track.explicit,
    popularity: track.popularity,
    preview_url: track.preview_url,
  })) as SpotifyTrack[];
}

export async function getArtistAlbums(artistId: string) {
  if (isMockMode()) return { items: [] };
  return getSpotifyApi().artists.albums(artistId, undefined, undefined, 20);
}

export async function getArtistRelatedArtists(artistId: string) {
  if (isMockMode()) {
    return { artists: [{ id: "mock-related-1", name: "Related Artist 1", images: [{ url: "" }], genres: ["electronic"] }] };
  }
  return getSpotifyApi().artists.relatedArtists(artistId);
}

export async function getPlaylist(playlistId: string) {
  if (isMockMode()) {
    return { id: playlistId, name: "Mock Playlist", images: [{ url: "" }], tracks: { total: 1 }, owner: { display_name: "Mock User" }, description: "" };
  }
  return getSpotifyApi().playlists.getPlaylist(playlistId);
}

export async function setShuffle(state: boolean) {
  if (isMockMode()) return;
  return spotifyFetch(`/me/player/shuffle?state=${state}`, {
    method: 'PUT',
    context: 'Set shuffle',
  });
}

export async function setRepeat(state: "off" | "context" | "track") {
  if (isMockMode()) return;
  return spotifyFetch(`/me/player/repeat?state=${state}`, {
    method: 'PUT',
    context: 'Set repeat',
  });
}

export async function playContext(contextUri: string, offsetUri?: string, deviceId?: string) {
  if (isMockMode()) return;
  const body: any = { context_uri: contextUri };
  if (offsetUri) body.offset = { uri: offsetUri };
  return spotifyFetch('/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ''), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    context: 'PlayContext',
  });
}

export async function playUris(uris: string[], offset?: number, deviceId?: string) {
  if (isMockMode()) return;
  const body: any = { uris };
  if (offset !== undefined) body.offset = { position: offset };
  return spotifyFetch('/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ''), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    context: 'PlayUris',
  });
}

export async function checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
  if (isMockMode()) return trackIds.map(() => false);
  return spotifyFetch(`/me/tracks/contains?ids=${trackIds.join(',')}`, {
    skipRetry: true,
    context: 'Check saved tracks',
  });
}

export async function saveTracks(trackIds: string[]): Promise<void> {
  if (isMockMode()) return;
  await spotifyFetch(`/me/tracks?ids=${trackIds.join(',')}`, {
    method: 'PUT',
    context: 'Save tracks',
  });
}

export async function removeSavedTracks(trackIds: string[]): Promise<void> {
  if (isMockMode()) return;
  await spotifyFetch(`/me/tracks?ids=${trackIds.join(',')}`, {
    method: 'DELETE',
    context: 'Remove saved tracks',
  });
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  if (isMockMode()) return;
  await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris }),
    context: 'Add tracks to playlist',
  });
}

export async function scanLocalDevices(): Promise<LocalDevice[]> {
  try {
    const result = await invoke<LocalDevice[]>("scan_spotify_devices");
    return result;
  } catch (e) {
    console.error("Failed to scan local devices:", e);
    if (isMockMode()) {
      return [
        { name: "Mock Speaker", ip: "192.168.1.100", port: 80 },
        { name: "Mock TV", ip: "192.168.1.101", port: 80 },
      ];
    }
    return [];
  }
}

/**
 * Get track recommendations based on seeds.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-recommendations
 */
export async function getRecommendations(options: {
  seedArtists?: string[];
  seedTracks?: string[];
  seedGenres?: string[];
  limit?: number;
  market?: string;
} = {}): Promise<SpotifyTrack[]> {
  if (isMockMode()) {
    return [];
  }

  const {
    seedArtists = [],
    seedTracks = [],
    seedGenres = [],
    limit = 20,
    market,
  } = options;

  // Validate seed count (max 5 combined)
  const totalSeeds = seedArtists.length + seedTracks.length + seedGenres.length;
  if (totalSeeds === 0) {
    throw new Error('At least one seed (artist, track, or genre) is required');
  }
  if (totalSeeds > 5) {
    throw new Error('Maximum 5 seeds allowed (combined artists, tracks, and genres)');
  }

  // Build query params
  const params = new URLSearchParams();
  if (seedArtists.length) params.set('seed_artists', seedArtists.join(','));
  if (seedTracks.length) params.set('seed_tracks', seedTracks.join(','));
  if (seedGenres.length) params.set('seed_genres', seedGenres.join(','));
  params.set('limit', String(Math.min(Math.max(1, limit), 100)));
  if (market) params.set('market', market);

  const data = await spotifyFetch(`/recommendations?${params.toString()}`, {
    context: 'GetRecommendations',
  });

  return (data.tracks || []).map((track: any) => ({
    id: track.id,
    name: track.name,
    uri: track.uri,
    duration_ms: track.duration_ms,
    artists: track.artists?.map((a: any) => ({ id: a.id, name: a.name })),
    album: track.album ? {
      id: track.album.id,
      name: track.album.name,
      images: track.album.images,
      release_date: track.album.release_date,
    } : undefined,
    images: track.album?.images,
    track_number: track.track_number,
    disc_number: track.disc_number,
    explicit: track.explicit,
    popularity: track.popularity,
    preview_url: track.preview_url,
  })) as SpotifyTrack[];
}

/**
 * Get new album releases.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-new-releases
 */
export async function getNewReleases(
  limit: number = 20,
  country?: string
): Promise<Array<{ id: string; name: string; artists: string; image: string; uri: string }>> {
  if (isMockMode()) {
    return [
      { id: "mock-album-1", name: "New Album 1", artists: "Mock Artist", image: "", uri: "spotify:album:mock1" },
      { id: "mock-album-2", name: "New Album 2", artists: "Mock Artist 2", image: "", uri: "spotify:album:mock2" },
    ];
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (country) params.set('country', country);

  const data = await spotifyFetch(`/browse/new-releases?${params.toString()}`, {
    context: 'GetNewReleases',
  });

  return (data.albums?.items || []).map((album: any) => ({
    id: album.id,
    name: album.name,
    artists: album.artists?.map((a: any) => a.name).join(', ') || '',
    image: album.images?.[0]?.url || '',
    uri: album.uri,
  }));
}

/**
 * Get audio features for a track.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-audio-features
 */
export async function getAudioFeatures(trackId: string): Promise<AudioFeaturesResponse | null> {
  if (isMockMode()) {
    return {
      id: trackId,
      danceability: 0.7,
      energy: 0.8,
      valence: 0.6,
      acousticness: 0.2,
      tempo: 120,
      loudness: -5,
      speechiness: 0.1,
      instrumentalness: 0.0,
      liveness: 0.3,
      key: 5,
      mode: 1,
      time_signature: 4,
      duration_ms: 180000,
      type: "audio_features",
      uri: `spotify:track:${trackId}`,
      track_href: "",
      analysis_url: "",
    };
  }
  const data = await spotifyFetch(`/audio-features/${trackId}`, {
    context: 'Audio features',
  });
  return data;
}

/**
 * Get audio analysis for a track (detailed breakdown).
 * @see https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis
 */
export async function getAudioAnalysis(trackId: string): Promise<AudioAnalysisResponse | null> {
  if (isMockMode()) return null;
  try {
    return await spotifyFetch(`/audio-analysis/${trackId}`, {
      context: 'Audio analysis',
    });
  } catch {
    return null;
  }
}

/**
 * Get browse categories.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-categories
 */
export async function getBrowseCategories(
  limit: number = 20
): Promise<Array<{ id: string; name: string; icons: string[] }>> {
  if (isMockMode()) {
    return [
      { id: "mock-cat-1", name: "Pop", icons: [""] },
      { id: "mock-cat-2", name: "Hip-Hop", icons: [""] },
    ];
  }

  const params = new URLSearchParams({ limit: String(limit) });
  const data = await spotifyFetch(`/browse/categories?${params.toString()}`, {
    context: 'GetBrowseCategories',
  });

  return (data.categories?.items || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    icons: cat.icons?.map((i: any) => i.url) || [],
  }));
}

/**
 * Get playlists for a browse category.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-categorys-playlists
 */
export async function getCategoryPlaylists(
  categoryId: string,
  limit: number = 20
): Promise<Array<{ id: string; name: string; image: string; uri: string }>> {
  if (isMockMode()) {
    return [
      { id: "mock-playlist-1", name: "Top 50 - Pop", image: "", uri: "spotify:playlist:mock1" },
      { id: "mock-playlist-2", name: "Chill Vibes", image: "", uri: "spotify:playlist:mock2" },
    ];
  }

  const params = new URLSearchParams({ limit: String(limit) });
  const data = await spotifyFetch(`/browse/categories/${categoryId}/playlists?${params.toString()}`, {
    context: 'GetCategoryPlaylists',
  });

  return (data.playlists?.items || []).map((playlist: any) => ({
    id: playlist.id,
    name: playlist.name,
    image: playlist.images?.[0]?.url || '',
    uri: playlist.uri,
  }));
}
