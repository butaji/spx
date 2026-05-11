import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";
import { invoke } from "@tauri-apps/api/core";

const TOKEN_STORAGE_KEY = 'spx_spotify_token';

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

const mockFeatured = {
  playlists: {
    items: [
      { id: "mock-feat-1", name: "Today's Top Hits", images: [{ url: "" }], tracks: { total: 50 } },
      { id: "mock-feat-2", name: "Discover Weekly", images: [{ url: "" }], tracks: { total: 30 } },
    ],
  },
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

const REDIRECT_URI = (import.meta.env.VITE_NGROK_URL || "http://127.0.0.1:1421") + "/callback";

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

function saveToken(token: AccessToken) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch (e) {
    console.error('Failed to save token:', e);
  }
}

function loadToken(): AccessToken | null {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AccessToken;
    }
  } catch (e) {
    console.error('Failed to load token:', e);
  }
  return null;
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
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
    scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-read-private user-read-email',
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
    const errorText = await response.text();
    console.error("Token exchange failed:", response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }
  console.log("Token exchange successful");

  const responseText = await response.text();
  console.log("Token response:", responseText.substring(0, 200));
  
  let data: AccessToken;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse token response as JSON:", responseText);
    throw new Error('Invalid token response from Spotify');
  }
  
  accessToken = data.access_token;

  // Save token for session persistence
  saveToken(data);

  // Create SDK instance with token
  const clientId = await getClientId();
  spotify = SpotifyApi.withAccessToken(clientId as string, data);

  return true;
}

export async function restoreSession(): Promise<boolean> {
  console.log("Attempting to restore session...");
  const token = loadToken();
  if (!token?.access_token) {
    console.log("No stored token found");
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
    clearToken();
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

export function isAuthenticated(): boolean {
  if (mockModeValue) return true;
  if (!!accessToken && !!spotify) return true;
  // Check if we have a stored token that could be restored
  const token = loadToken();
  return !!token?.access_token;
}

export function logout() {
  accessToken = null;
  spotify = null;
  tokenVerifier = null;
  clearToken();
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

export async function play() {
  if (isMockMode()) {
    mockPlaybackState.is_playing = true;
    return;
  }
  return getSpotifyApi().player.startResumePlayback("");
}

export async function pause() {
  if (isMockMode()) {
    mockPlaybackState.is_playing = false;
    return;
  }
  return getSpotifyApi().player.pausePlayback("");
}

export async function next() {
  if (isMockMode()) {
    mockPlaybackState.progress_ms = 0;
    mockPlaybackState.is_playing = true;
    return;
  }
  return getSpotifyApi().player.skipToNext("");
}

export async function previous() {
  if (isMockMode()) {
    mockPlaybackState.progress_ms = 0;
    mockPlaybackState.is_playing = true;
    return;
  }
  return getSpotifyApi().player.skipToPrevious("");
}

export async function seek(positionMs: number) {
  if (isMockMode()) return;
  return getSpotifyApi().player.seekToPosition(positionMs, "");
}

export async function setVolume(volumePercent: number) {
  if (isMockMode()) return;
  return getSpotifyApi().player.setPlaybackVolume(volumePercent, "");
}

export async function getAvailableDevices() {
  if (isMockMode()) return mockDevices;
  return getSpotifyApi().player.getAvailableDevices();
}

export async function transferPlayback(deviceId: string, play?: boolean) {
  return getSpotifyApi().player.transferPlayback([deviceId], play ?? true);
}

export async function getQueue() {
  if (isMockMode()) return mockQueue;
  return getSpotifyApi().player.getUsersQueue();
}

export async function search(query: string) {
  if (isMockMode()) return mockSearch;
  return getSpotifyApi().search(query, ["track", "album", "artist", "playlist"]);
}

export async function getUserPlaylists() {
  if (isMockMode()) return mockPlaylists;
  return getSpotifyApi().currentUser.playlists.playlists();
}

export async function getPlaylistTracks(playlistId: string) {
  return getSpotifyApi().playlists.getPlaylistItems(playlistId);
}

export async function getSavedTracks() {
  return getSpotifyApi().currentUser.tracks.savedTracks();
}

export async function getSavedAlbums() {
  return getSpotifyApi().currentUser.albums.savedAlbums();
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

export async function getArtistAlbums(artistId: string) {
  if (isMockMode()) return { items: [] };
  return getSpotifyApi().artists.albums(artistId, undefined, undefined, 20);
}

export async function getFeaturedPlaylists() {
  if (isMockMode()) return mockFeatured;
  return getSpotifyApi().browse.getFeaturedPlaylists();
}

export async function getPlaylist(playlistId: string) {
  return getSpotifyApi().playlists.getPlaylist(playlistId);
}

export async function setShuffle(state: boolean) {
  if (isMockMode()) return;
  return getSpotifyApi().player.togglePlaybackShuffle(state, "");
}

export async function setRepeat(state: "off" | "context" | "track") {
  if (isMockMode()) return;
  return getSpotifyApi().player.setRepeatMode(state, "");
}

export async function playContext(contextUri: string, offsetUri?: string) {
  if (isMockMode()) return;
  const offset = offsetUri ? { uri: offsetUri } : undefined;
  return getSpotifyApi().player.startResumePlayback("", contextUri, undefined, offset);
}

export async function playUris(uris: string[], offset?: number) {
  if (isMockMode()) return;
  const offsetObj = offset !== undefined ? { position: offset } : undefined;
  return getSpotifyApi().player.startResumePlayback("", undefined, uris, offsetObj);
}
