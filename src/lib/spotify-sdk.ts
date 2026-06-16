/**
 * Spotify Web SDK - PKCE OAuth + API wrapper
 * 
 * Uses official Spotify Web API via spotify-web-api-js
 * PKCE auth happens entirely in browser - no backend needed
 * 
 * Secrets are stored securely in .env (not exposed to frontend)
 * Rust backend only for: device discovery, system notifications
 */

import SpotifyWebApi from 'spotify-web-api-js';
import { open } from '@tauri-apps/plugin-shell';

// ─── Configuration ───────────────────────────────────────────────────────────

const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
  'user-read-recently-played',
  'user-top-read',
  'user-follow-read',
].join(' ');

// Allow the redirect URI to be configured per environment. Defaults to the
// standard SPX callback port (must match the backend OAuth callback server
// and the Redirect URI registered in the Spotify app dashboard).
const REDIRECT_URI = (import.meta as any).env?.VITE_SPOTIFY_REDIRECT_URI ||
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_SPOTIFY_REDIRECT_URI) ||
  'http://127.0.0.1:1422/callback';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// ─── PKCE Helpers ────────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  if (window.crypto?.subtle) {
    return window.crypto.subtle.digest('SHA-256', data);
  }

  // Fallback for non-secure contexts (e.g. LAN IP over HTTP) where Web Crypto
  // is unavailable.
  return sha256Js(data);
}

// Pure-JavaScript SHA-256 for insecure HTTP contexts.
function sha256Js(data: Uint8Array): ArrayBuffer {
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function rotr(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }

  function ch(x: number, y: number, z: number) {
    return (x & y) ^ (~x & z);
  }

  function maj(x: number, y: number, z: number) {
    return (x & y) ^ (x & z) ^ (y & z);
  }

  function sigma0(x: number) {
    return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  }

  function sigma1(x: number) {
    return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  }

  function gamma0(x: number) {
    return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  }

  function gamma1(x: number) {
    return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
  }

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

  const totalBits = data.length * 8;
  const padLen = Math.ceil((totalBits + 65) / 512) * 64;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, totalBits, false);

  for (let i = 0; i < padLen; i += 64) {
    const w = new Uint32Array(64);
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      w[t] = (gamma1(w[t - 2]) + w[t - 7] + gamma0(w[t - 15]) + w[t - 16]) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let t = 0; t < 64; t++) {
      const t1 = (hh + sigma1(e) + ch(e, f, g) + k[t] + w[t]) >>> 0;
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const result = new ArrayBuffer(32);
  const resultView = new DataView(result);
  for (let i = 0; i < 8; i++) {
    resultView.setUint32(i * 4, h[i], false);
  }
  return result;
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// ─── Token Storage ───────────────────────────────────────────────────────────

const TOKEN_KEY = 'spx_spotify_token';

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

function saveToken(token: StoredToken) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function loadToken(): StoredToken | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  const token = loadToken();
  if (!token || Date.now() >= token.expiresAt - 60000) {
    return null;
  }
  return token.accessToken;
}

export interface TokenInfo {
  present: boolean;
  expired: boolean;
  expiresAt: number | null;
  hasRefreshToken: boolean;
  preview: string | null;
}

export function getTokenInfo(): TokenInfo {
  const token = loadToken();
  if (!token) {
    return { present: false, expired: true, expiresAt: null, hasRefreshToken: false, preview: null };
  }
  const expired = Date.now() >= token.expiresAt - 60000;
  const preview = token.accessToken
    ? `${token.accessToken.slice(0, 6)}…${token.accessToken.slice(-6)}`
    : null;
  return {
    present: true,
    expired,
    expiresAt: token.expiresAt,
    hasRefreshToken: !!token.refreshToken,
    preview,
  };
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function isTokenExpired(token: StoredToken): boolean {
  return Date.now() >= token.expiresAt - 60000; // 1 min buffer
}

// ─── SDK Instance ────────────────────────────────────────────────────────────

const spotifyApi = new SpotifyWebApi();

// ─── Client ID (from .env via Tauri) ───────────────────────────────────────

let cachedClientId: string | null = null;

async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  
  let clientId: string | null = null;
  
  // Try to get from Tauri command
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    clientId = await invoke<string>("get_spotify_client_id");
  } catch {
    // Fall through
  }
  
  // Fallback to env var
  if (!clientId) {
    clientId = (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID || null;
  }
  
  // Final fallback
  cachedClientId = clientId || 'e1c9ee463a394fee84e031daa1665db2';
  return cachedClientId;
}

// ─── Auth Flow ──────────────────────────────────────────────────────────────

const PKCE_VERIFIER_KEY = 'pkce_verifier';
const OAUTH_STATE_KEY = 'oauth_state';

export async function startAuthFlow(): Promise<void> {
  const clientId = await getClientId();
  
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);
  
  // Generate CSRF state parameter
  const state = generateRandomString(32);
  
  // Store verifier and state for token exchange
  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  
  // Build auth URL
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state: state,
  });
  
  // Open Spotify auth page in default browser
  const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
  const isBrowser = (window as any).__TAURI_INTERNALS__?.__is_spx_shim__ === true;

  if (isBrowser) {
    // In plain browser mode we can't open an external app; navigate directly.
    window.location.href = authUrl;
    return;
  }

  try {
    await open(authUrl);
  } catch (e) {
    console.error('[Auth] Failed to open browser:', e);
    throw new Error('Failed to open browser. Please check your settings.');
  }
}

export async function handleAuthCallback(code: string, state?: string): Promise<boolean> {
  // Validate state parameter for CSRF protection
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  if (state && expectedState && state !== expectedState) {
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    throw new Error('Invalid state parameter. Possible CSRF attack.');
  }
  
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('PKCE verifier not found. Please try again.');
  }
  
  // Clean up state
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  
  const clientId = await getClientId();
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Auth failed: ${error.error_description || error.error}`);
  }
  
  const data = await response.json();
  
  const token: StoredToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  
  saveToken(token);
  spotifyApi.setAccessToken(token.accessToken);
  
  // Clean up
  sessionStorage.removeItem('pkce_verifier');
  
  return true;
}

export async function refreshAccessToken(): Promise<boolean> {
  const token = loadToken();
  if (!token?.refreshToken) {
    return false;
  }
  
  try {
    const clientId = await getClientId();
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });
    
    if (!response.ok) {
      clearStoredToken();
      return false;
    }
    
    const data = await response.json();
    
    const newToken: StoredToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
    
    saveToken(newToken);
    spotifyApi.setAccessToken(newToken.accessToken);
    
    return true;
  } catch {
    return false;
  }
}

export function isAuthenticated(): boolean {
  const token = loadToken();
  return !!token && !isTokenExpired(token);
}

export async function ensureValidToken(): Promise<boolean> {
  const token = loadToken();
  if (!token) return false;
  
  if (isTokenExpired(token)) {
    if (token.refreshToken) {
      return await refreshAccessToken();
    }
    return false;
  }
  
  spotifyApi.setAccessToken(token.accessToken);
  return true;
}

export function logout() {
  clearStoredToken();
  spotifyApi.setAccessToken('');
}

// ─── API Wrappers with Clear Errors ─────────────────────────────────────────

async function apiCall<T>(fn: () => Promise<T>, _context: string): Promise<T> {
  const valid = await ensureValidToken();
  if (!valid) {
    throw new Error(`Not authenticated. Please sign in to Spotify.`);
  }
  
  try {
    return await fn();
  } catch (error: any) {
    // Provide clearer error messages
    if (error?.status === 401) {
      clearStoredToken();
      throw new Error(`Session expired. Please sign in again.`);
    }
    if (error?.status === 403) {
      throw new Error(`Access denied. Spotify Premium may be required for this action.`);
    }
    if (error?.status === 404) {
      throw new Error(`Not found. The requested content may have been removed.`);
    }
    if (error?.status === 429) {
      throw new Error(`Too many requests. Please wait a moment and try again.`);
    }
    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      throw new Error(`Network error. Check your internet connection.`);
    }
    throw error;
  }
}

// ─── Playback API ────────────────────────────────────────────────────────────

export async function getPlaybackState() {
  return apiCall(() => spotifyApi.getMyCurrentPlaybackState(), 'getPlaybackState');
}

export async function play(deviceId?: string) {
  return apiCall(() => spotifyApi.play({ device_id: deviceId }), 'play');
}

export async function pause(deviceId?: string) {
  return apiCall(() => spotifyApi.pause({ device_id: deviceId }), 'pause');
}

export async function nextTrack() {
  return apiCall(() => spotifyApi.skipToNext(), 'nextTrack');
}

export async function previousTrack() {
  return apiCall(() => spotifyApi.skipToPrevious(), 'previousTrack');
}

export async function seek(positionMs: number, deviceId?: string) {
  return apiCall(() => spotifyApi.seek(positionMs, { device_id: deviceId }), 'seek');
}

export async function setVolume(volumePercent: number, deviceId?: string) {
  return apiCall(() => spotifyApi.setVolume(volumePercent, { device_id: deviceId }), 'setVolume');
}

export async function toggleShuffle(state: boolean, deviceId?: string) {
  return apiCall(() => spotifyApi.setShuffle(state, { device_id: deviceId }), 'toggleShuffle');
}

export async function setRepeat(state: 'off' | 'track' | 'context', deviceId?: string) {
  return apiCall(() => spotifyApi.setRepeat(state, { device_id: deviceId }), 'setRepeat');
}

export async function transferPlayback(deviceId: string, play = true) {
  return apiCall(() => spotifyApi.transferMyPlayback([deviceId], { play }), 'transferPlayback');
}

// ─── Context Playback ────────────────────────────────────────────────────────

export async function playContext(contextUri: string, offset?: number | string, deviceId?: string) {
  return apiCall(() => spotifyApi.play({
    context_uri: contextUri,
    offset: offset !== undefined
      ? (typeof offset === 'string' ? { uri: offset } : { position: offset })
      : undefined,
    device_id: deviceId,
  }), 'playContext');
}

export async function playUris(uris: string[], offset?: number, deviceId?: string) {
  return apiCall(() => spotifyApi.play({
    uris,
    offset: offset !== undefined ? { position: offset } : undefined,
    device_id: deviceId,
  }), 'playUris');
}

// ─── Queue ──────────────────────────────────────────────────────────────────

export async function addToQueue(uri: string, deviceId?: string) {
  return apiCall(async () => {
    const token = loadToken();
    if (!token) throw new Error('Not authenticated');
    
    const url = 'https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(uri) + (deviceId ? '&device_id=' + deviceId : '');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.accessToken}` }
    });
    if (!response.ok) throw new Error(`Failed to add to queue: ${response.status}`);
    return true;
  }, 'addToQueue');
}

// ─── User & Library ─────────────────────────────────────────────────────────

export async function getCurrentUser() {
  return apiCall(() => spotifyApi.getMe(), 'getCurrentUser');
}

export async function getUserPlaylists(limit = 50, offset = 0) {
  return apiCall(() => spotifyApi.getUserPlaylists(undefined, { limit, offset }), 'getUserPlaylists');
}

export async function getMySavedTracks(limit = 50, offset = 0) {
  return apiCall(() => spotifyApi.getMySavedTracks({ limit, offset }), 'getMySavedTracks');
}

export async function getMySavedAlbums(limit = 50, offset = 0) {
  return apiCall(() => spotifyApi.getMySavedAlbums({ limit, offset }), 'getMySavedAlbums');
}

export async function getMyTop(type: 'artists' | 'tracks', timeRange = 'medium_term', limit = 50) {
  if (type === 'artists') {
    const result = await apiCall(() => spotifyApi.getMyTopArtists({ time_range: timeRange, limit }), 'getMyTop');
    return result?.items || [];
  } else {
    const result = await apiCall(() => spotifyApi.getMyTopTracks({ time_range: timeRange, limit }), 'getMyTop');
    return result?.items || [];
  }
}

export async function getMyRecentlyPlayed(limit = 50) {
  return apiCall(() => spotifyApi.getMyRecentlyPlayedTracks({ limit }), 'getMyRecentlyPlayed');
}

export async function getMyFollowedArtists(limit = 50, after?: string) {
  const result = await apiCall(() => spotifyApi.getFollowedArtists({ limit, after }), 'getMyFollowedArtists');
  return result?.artists?.items || [];
}

// ─── Browse ──────────────────────────────────────────────────────────────────

export async function getNewReleases(limit = 50, offset = 0) {
  const result = await apiCall(() => spotifyApi.getNewReleases({ limit, offset }), 'getNewReleases');
  return result?.albums?.items || [];
}

export async function getCategories(limit = 50, offset = 0) {
  const result = await apiCall(() => spotifyApi.getCategories({ limit, offset }), 'getCategories');
  return result?.categories?.items || [];
}

export async function getCategoryPlaylists(categoryId: string, limit = 50, offset = 0) {
  const result = await apiCall(() => spotifyApi.getCategoryPlaylists(categoryId, { limit, offset }), 'getCategoryPlaylists');
  return result?.playlists?.items || [];
}

export async function getRecommendations(options: {
  seedTracks?: string[];
  seedArtists?: string[];
  seedGenres?: string[];
  limit?: number;
  minEnergy?: number;
  minValence?: number;
}) {
  return apiCall(() => spotifyApi.getRecommendations({
    seed_tracks: options.seedTracks?.slice(0, 5),
    seed_artists: options.seedArtists?.slice(0, 5),
    seed_genres: options.seedGenres?.slice(0, 5),
    limit: options.limit || 20,
    min_energy: options.minEnergy,
    min_valence: options.minValence,
  }), 'getRecommendations');
}

// ─── Search ─────────────────────────────────────────────────────────────────

export async function search(query: string, types: ('album' | 'artist' | 'playlist' | 'track')[] = ['track', 'album', 'artist', 'playlist'], limit = 50) {
  return apiCall(() => spotifyApi.search(query, types, { limit }), 'search');
}

// ─── Playlists ───────────────────────────────────────────────────────────────

export async function getPlaylist(playlistId: string) {
  return apiCall(() => spotifyApi.getPlaylist(playlistId), 'getPlaylist');
}

export async function getPlaylistTracks(playlistId: string, limit = 100, offset = 0) {
  return apiCall(() => spotifyApi.getPlaylistTracks(playlistId, { limit, offset }), 'getPlaylistTracks');
}

export async function getUserPlaylist(userId: string, playlistId: string) {
  return apiCall(() => spotifyApi.getPlaylist(`${userId}/${playlistId}`), 'getUserPlaylist');
}

// ─── Albums ──────────────────────────────────────────────────────────────────

export async function getAlbum(albumId: string) {
  return apiCall(() => spotifyApi.getAlbum(albumId), 'getAlbum');
}

export async function getAlbumTracks(albumId: string, limit = 50, offset = 0) {
  return apiCall(() => spotifyApi.getAlbumTracks(albumId, { limit, offset }), 'getAlbumTracks');
}

export async function getAlbums(ids: string[]) {
  return apiCall(() => spotifyApi.getAlbums(ids), 'getAlbums');
}

// ─── Artists ────────────────────────────────────────────────────────────────

export async function getArtist(artistId: string) {
  return apiCall(() => spotifyApi.getArtist(artistId), 'getArtist');
}

export async function getArtistTopTracks(artistId: string, country = 'US') {
  return apiCall(() => spotifyApi.getArtistTopTracks(artistId, country), 'getArtistTopTracks');
}

export async function getArtistAlbums(artistId: string, options?: { album_type?: string; limit?: number; offset?: number }) {
  return apiCall(() => spotifyApi.getArtistAlbums(artistId, options), 'getArtistAlbums');
}

export async function getArtistRelatedArtists(artistId: string) {
  return apiCall(() => spotifyApi.getArtistRelatedArtists(artistId), 'getArtistRelatedArtists');
}

export async function getArtists(ids: string[]) {
  return apiCall(() => spotifyApi.getArtists(ids), 'getArtists');
}

// ─── Tracks ─────────────────────────────────────────────────────────────────

export async function getTrack(trackId: string) {
  return apiCall(() => spotifyApi.getTrack(trackId), 'getTrack');
}

export async function getTracks(ids: string[]) {
  return apiCall(() => spotifyApi.getTracks(ids), 'getTracks');
}

export async function getAudioFeatures(trackId: string) {
  return apiCall(() => spotifyApi.getAudioFeaturesForTrack(trackId), 'getAudioFeatures');
}

export async function getAudioFeaturesMultiple(trackIds: string[]) {
  return apiCall(() => spotifyApi.getAudioFeaturesForTracks(trackIds), 'getAudioFeaturesMultiple');
}

// Audio analysis is not in the SDK, use direct fetch
export async function getAudioAnalysis(trackId: string) {
  return apiCall(async () => {
    const token = loadToken();
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token.accessToken}` }
    });
    if (!response.ok) throw new Error(`Failed to get audio analysis: ${response.status}`);
    return response.json();
  }, 'getAudioAnalysis');
}

// ─── Library Actions ─────────────────────────────────────────────────────────

export async function saveTracks(ids: string[]) {
  return apiCall(() => spotifyApi.addToMySavedTracks(ids), 'saveTracks');
}

export async function removeTracks(ids: string[]) {
  return apiCall(() => spotifyApi.removeFromMySavedTracks(ids), 'removeTracks');
}

export async function checkSavedTracks(ids: string[]) {
  return apiCall(() => spotifyApi.containsMySavedTracks(ids), 'checkSavedTracks');
}

export async function saveAlbums(ids: string[]) {
  return apiCall(() => spotifyApi.addToMySavedAlbums(ids), 'saveAlbums');
}

export async function removeAlbums(ids: string[]) {
  return apiCall(() => spotifyApi.removeFromMySavedAlbums(ids), 'removeAlbums');
}

export async function checkSavedAlbums(ids: string[]) {
  return apiCall(() => spotifyApi.containsMySavedAlbums(ids), 'checkSavedAlbums');
}

export async function followPlaylist(ownerId: string, playlistId: string) {
  return apiCall(() => spotifyApi.followPlaylist(`${ownerId}/${playlistId}`), 'followPlaylist');
}

export async function unfollowPlaylist(ownerId: string, playlistId: string) {
  return apiCall(() => spotifyApi.unfollowPlaylist(`${ownerId}/${playlistId}`), 'unfollowPlaylist');
}

export async function followArtists(artistIds: string[]) {
  return apiCall(() => spotifyApi.followArtists(artistIds), 'followArtists');
}

export async function unfollowArtists(artistIds: string[]) {
  return apiCall(() => spotifyApi.unfollowArtists(artistIds), 'unfollowArtists');
}

export async function checkFollowingArtists(artistIds: string[]) {
  return apiCall(() => spotifyApi.isFollowingArtists(artistIds), 'checkFollowingArtists');
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export async function getMyDevices() {
  return apiCall(() => spotifyApi.getMyDevices(), 'getMyDevices');
}

// ─── Queue ──────────────────────────────────────────────────────────────────

// Note: getMyQueue is not in spotify-web-api-js, use fetch directly
export async function getMyQueue() {
  const valid = await ensureValidToken();
  if (!valid) throw new Error('Not authenticated');
  
  const token = loadToken();
  const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
    headers: { 'Authorization': `Bearer ${token?.accessToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get queue: ${response.status}`);
  }
  
  return response.json();
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const SpotifySDK = {
  // Auth
  startAuthFlow,
  handleAuthCallback,
  refreshAccessToken,
  isAuthenticated,
  logout,
  
  // Playback
  getPlaybackState,
  play,
  pause,
  nextTrack,
  previousTrack,
  seek,
  setVolume,
  toggleShuffle,
  setRepeat,
  transferPlayback,
  playContext,
  playUris,
  addToQueue,
  
  // User
  getCurrentUser,
  getUserPlaylists,
  getMySavedTracks,
  getMySavedAlbums,
  getMyTop,
  getMyRecentlyPlayed,
  getMyFollowedArtists,
  
  // Browse
  getNewReleases,
  getCategories,
  getCategoryPlaylists,
  getRecommendations,
  
  // Search
  search,
  
  // Playlists
  getPlaylist,
  getPlaylistTracks,
  getUserPlaylist,
  
  // Albums
  getAlbum,
  getAlbumTracks,
  getAlbums,
  
  // Artists
  getArtist,
  getArtistTopTracks,
  getArtistAlbums,
  getArtistRelatedArtists,
  getArtists,
  
  // Tracks
  getTrack,
  getTracks,
  getAudioFeatures,
  getAudioFeaturesMultiple,
  getAudioAnalysis,
  
  // Library
  saveTracks,
  removeTracks,
  checkSavedTracks,
  saveAlbums,
  removeAlbums,
  checkSavedAlbums,
  followPlaylist,
  unfollowPlaylist,
  followArtists,
  unfollowArtists,
  checkFollowingArtists,
  
  // Devices
  getMyDevices,
  
  // Queue
  getMyQueue,
};

export default SpotifySDK;
