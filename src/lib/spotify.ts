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

const TOKEN_STORAGE_KEY = 'spx_spotify_token';
const STORE_PATH = 'spotify-auth.bin';

// Recording config
const RECORD_API = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_SPX_RECORD === '1';


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
  console.log(`[API_RECORD] ${filename}:`, JSON.stringify(recording, null, 2).slice(0, 300));
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

const REDIRECT_URI = "http://127.0.0.1:1421/callback";

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
  console.log("Getting Spotify client ID...");
  if (clientId) return clientId;
  clientId = await invoke<string>("get_spotify_client_id");
  console.log("Resolved client ID:", clientId);
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
  console.log("Starting auth flow...");
  // Start callback server in background
  const serverPromise = invoke<[string, string] | null>("start_callback_server");

  const id = await getClientId();
  tokenVerifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(tokenVerifier);
  const state = generateCodeVerifier().slice(0, 16);

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

  console.log("redirect_uri:", REDIRECT_URI);
  console.log("client_id:", id);
  console.log("Opening Spotify auth URL:", authUrl);

  // Open in browser using Tauri shell
  const { open } = await import('@tauri-apps/plugin-shell');
  await open(authUrl);

  console.log("Waiting for callback server...");
  const result = await serverPromise;
  if (!result) {
    console.log("Callback server returned null");
    throw new Error("Auth timeout or cancelled");
  }
  console.log("Got callback result:", result);

  const [code] = result;
  await exchangeCode(code);
}

export async function exchangeCode(code: string): Promise<boolean> {
  console.log("Exchanging code for token...");
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

  console.log("Response status:", response.status);
  if (!response.ok) {
    try {
      const errorData = JSON.parse(await response.text());
      throw new Error(errorData.error?.message || `Token exchange failed: ${response.status}`);
    } catch (e: any) {
      if (e.message && !e.message.includes(response.status.toString())) throw e;
      throw new Error(`Token exchange failed: HTTP ${response.status}`);
    }
  }
  console.log("Token exchange successful");

  const responseText = await response.text();
  console.log("Token response:", responseText.substring(0, 200));
  
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
  console.log("Refreshing access token...");
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
      try {
        const errorData = JSON.parse(await response.text());
        throw new Error(errorData.error?.message || `Token refresh failed: ${response.status}`);
      } catch (e: any) {
        if (e.message && !e.message.includes(response.status.toString())) throw e;
        throw new Error(`Token refresh failed: HTTP ${response.status}`);
      }
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
    console.log("Token refreshed successfully");
    return true;
  } catch (e) {
    console.error("Failed to refresh token:", e);
    return false;
  }
}

export async function restoreSession(): Promise<boolean> {
  console.log("Attempting to restore session...");
  const token = await loadToken();
  if (!token?.access_token) {
    console.log("No stored token found");
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
    console.log("Token expired, attempting refresh...");
    const refreshed = await refreshAccessToken(token.refresh_token);
    if (refreshed) {
      return true;
    }
    // Refresh failed, clear and force re-auth
    await clearToken();
    return false;
  }

  if (isExpired && !token.refresh_token) {
    console.log("Token expired and no refresh token available");
    await clearToken();
    return false;
  }

  console.log("Found stored token, restoring...");
  accessToken = token.access_token;

  try {
    const clientId = await getClientId();
    spotify = SpotifyApi.withAccessToken(clientId as string, token);
    console.log("Session restored successfully");
    return true;
  } catch (e) {
    console.error("Failed to restore session:", e);
    await clearToken();
    return false;
  }
}

export async function handleCallbackUrl(url: string): Promise<boolean> {
  console.log("Handling callback URL:", url);
  // Handle both com.spx.app://callback?code=xxx and http://callback?code=xxx formats
  const normalizedUrl = url.replace('com.spx.app://callback', 'http://callback');
  const urlObj = new URL(normalizedUrl);
  const code = urlObj.searchParams.get('code');
  const error = urlObj.searchParams.get('error');

  console.log("Extracted code:", code);
  if (error) {
    throw new Error(`Spotify auth error: ${error}`);
  }

  if (!code || !tokenVerifier) {
    throw new Error('No authorization code found');
  }

  return exchangeCode(code);
}

export async function isAuthenticated(): Promise<boolean> {
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

export async function getPlaybackState() {
  if (isMockMode()) return mockPlaybackState;
  return getSpotifyApi().player.getPlaybackState();
}

export async function play(deviceId?: string) {
  if (isMockMode()) {
    mockPlaybackState.is_playing = true;
    return;
  }
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch('https://api.spotify.com/v1/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ''), {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    const data = JSON.parse(text);
    await recordFetch('https://api.spotify.com/v1/me/player/play', { method: 'PUT' }, response, data);
    return data;
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function pause() {
  if (isMockMode()) {
    mockPlaybackState.is_playing = false;
    return;
  }
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function next() {
  if (isMockMode()) {
    mockPlaybackState.progress_ms = 0;
    mockPlaybackState.is_playing = true;
    return;
  }
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Skip next failed: ${response.status}`);
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try { return JSON.parse(text); } catch { return; }
}

export async function previous() {
  if (isMockMode()) {
    mockPlaybackState.progress_ms = 0;
    mockPlaybackState.is_playing = true;
    return;
  }
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Skip previous failed: ${response.status}`);
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try { return JSON.parse(text); } catch { return; }
}

export async function seek(positionMs: number) {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function setVolume(volumePercent: number) {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volumePercent}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function getAvailableDevices() {
  if (isMockMode()) return mockDevices;
  return getSpotifyApi().player.getAvailableDevices();
}

export async function transferPlayback(deviceId: string, play?: boolean) {
  if (isMockMode()) {
    return Promise.resolve();
  }
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: play ?? true }),
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function getQueue() {
  if (isMockMode()) return mockQueue;
  return getSpotifyApi().player.getUsersQueue();
}

export async function getRecentlyPlayedTracks(limit?: number) {
  if (isMockMode()) return { items: [] };
  return getSpotifyApi().player.getRecentlyPlayedTracks((limit ?? 50) as 50);
}

export async function search(query: string) {
  if (isMockMode()) return mockSearch;
  return getSpotifyApi().search(query, ["track", "album", "artist", "playlist"]);
}

export async function getUserPlaylists() {
  if (isMockMode()) return mockPlaylists;
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
  if (isMockMode()) {
    return [mockArtist];
  }

  const url = `https://api.spotify.com/v1/me/following?type=artist&limit=${Math.min(limit, 50)}`;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const response = await withRetry(() =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Followed artists failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Followed artists failed: ${response.status}`);
    }
  }

  const data = await response.json();

  await recordFetch(url, { method: 'GET' }, response, data);

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
  return getSpotifyApi().currentUser.profile();
}

export async function getAlbum(albumId: string) {
  if (isMockMode()) return mockAlbum;
  return getSpotifyApi().albums.get(albumId);
}

export async function getArtist(artistId: string) {
  if (isMockMode()) return mockArtist;
  return getSpotifyApi().artists.get(artistId);
}

export async function getArtistTopTracks(artistId: string) {
  if (isMockMode()) return mockArtistTopTracks;
  return getSpotifyApi().artists.topTracks(artistId, "US");
}

export async function getTopArtists(
  limit: number = 20,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term'
): Promise<SpotifyArtist[]> {
  if (isMockMode()) return [];

  const url = `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=${timeRange}`;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const response = await withRetry(() =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Top artists failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  await recordFetch(url, { method: 'GET' }, response, data);

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

  const url = `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=${timeRange}`;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  let response: Response;
  try {
    response = await withRetry(() =>
      fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    );
  } catch (e) {
    console.error('Top tracks request failed:', e);
    throw e;
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  const text = await response.text();
  if (!text) return [];

  let data: { items: any[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from top tracks endpoint');
  }

  await recordFetch(url, { method: 'GET' }, response, data);

  return (data.items || []).map((track) => ({
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
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Set shuffle failed: ${response.status}`);
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try { return JSON.parse(text); } catch { return; }
}

export async function setRepeat(state: "off" | "context" | "track") {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${state}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Set repeat failed: ${response.status}`);
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try { return JSON.parse(text); } catch { return; }
}

export async function playContext(contextUri: string, offsetUri?: string) {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const body: any = { context_uri: contextUri };
  if (offsetUri) body.offset = { uri: offsetUri };
  const response = await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function playUris(uris: string[], offset?: number, deviceId?: string) {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const body: any = { uris };
  if (offset !== undefined) body.offset = { position: offset };
  const response = await fetch('https://api.spotify.com/v1/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ''), {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }
  if (response.status === 204) return;
  const text = await response.text();
  if (!text) return;
  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) return;
    throw new Error(text || `Request failed: ${response.status}`);
  }
}

export async function checkSavedTracks(trackIds: string[]): Promise<boolean[]> {
  if (isMockMode()) return trackIds.map(() => false);
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const url = `https://api.spotify.com/v1/me/tracks/contains?ids=${trackIds.join(',')}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Check saved tracks failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function saveTracks(trackIds: string[]): Promise<void> {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackIds.join(',')}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Save tracks failed: ${response.status} ${text}`);
  }
}

export async function removeSavedTracks(trackIds: string[]): Promise<void> {
  if (isMockMode()) return;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackIds.join(',')}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Remove saved tracks failed: ${response.status} ${text}`);
  }
}

export async function scanLocalDevices(): Promise<LocalDevice[]> {
  if (isMockMode()) {
    return [
      { name: "Mock Speaker", ip: "192.168.1.100", port: 80 },
      { name: "Mock TV", ip: "192.168.1.101", port: 80 },
    ];
  }
  try {
    return await invoke<LocalDevice[]>("scan_spotify_devices");
  } catch (e) {
    console.error("Failed to scan local devices:", e);
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

  const url = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  let response: Response;
  try {
    response = await withRetry(() =>
      fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    );
  } catch (e) {
    console.error('Recommendations request failed:', e);
    throw e;
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  const text = await response.text();
  if (!text) return [];

  let data: { tracks: any[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from recommendations endpoint');
  }

  await recordFetch(url, { method: 'GET' }, response, data);

  return (data.tracks || []).map((track) => ({
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

  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({ limit: String(limit) });
  if (country) params.set('country', country);

  const url = `https://api.spotify.com/v1/browse/new-releases?${params.toString()}`;

  let response: Response;
  try {
    response = await withRetry(() =>
      fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    );
  } catch (e) {
    console.error('New releases request failed:', e);
    throw e;
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  const text = await response.text();
  if (!text) return [];

  let data: { albums: { items: any[] } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from new releases endpoint');
  }

  await recordFetch(url, { method: 'GET' }, response, data);

  return (data.albums?.items || []).map((album) => ({
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
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const url = `https://api.spotify.com/v1/audio-features/${trackId}`;
  const response = await withRetry(() =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Audio features failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Audio features failed: ${response.status}`);
    }
  }
  const data = await response.json();
  await recordFetch(url, { method: 'GET' }, response, data);
  return data;
}

/**
 * Get audio analysis for a track (detailed breakdown).
 * @see https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis
 */
export async function getAudioAnalysis(trackId: string): Promise<AudioAnalysisResponse | null> {
  if (isMockMode()) return null;
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const url = `https://api.spotify.com/v1/audio-analysis/${trackId}`;
  const response = await withRetry(() =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  await recordFetch(url, { method: 'GET' }, response, data);
  return data;
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

  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({ limit: String(limit) });
  const url = `https://api.spotify.com/v1/browse/categories?${params.toString()}`;

  let response: Response;
  try {
    response = await withRetry(() =>
      fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    );
  } catch (e) {
    console.error('Browse categories request failed:', e);
    throw e;
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  const text = await response.text();
  if (!text) return [];

  let data: { categories: { items: any[] } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from categories endpoint');
  }

  await recordFetch(url, { method: 'GET' }, response, data);

  return (data.categories?.items || []).map((cat) => ({
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

  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({ limit: String(limit) });
  const url = `https://api.spotify.com/v1/browse/categories/${categoryId}/playlists?${params.toString()}`;

  let response: Response;
  try {
    response = await withRetry(() =>
      fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    );
  } catch (e) {
    console.error('Category playlists request failed:', e);
    throw e;
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
    } catch (e) {
      if (e instanceof Error && !e.message.includes(response.status.toString())) throw e;
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  const text = await response.text();
  if (!text) return [];

  let data: { playlists: { items: any[] } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from category playlists endpoint');
  }

  await recordFetch(url, { method: 'GET' }, response, data);

  return (data.playlists?.items || []).map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    image: playlist.images?.[0]?.url || '',
    uri: playlist.uri,
  }));
}
