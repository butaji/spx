/**
 * SPX Spotify API - Simplified with Official SDK + Custom PKCE Auth
 * 
 * Uses @spotify/web-api-ts-sdk for typed API calls
 * Keeps custom PKCE for external browser auth (SDK uses redirect)
 * Keeps mock mode for offline development
 */

// @ts-nocheck - Complex SDK integration with custom auth

import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { open } from '@tauri-apps/plugin-shell';
import * as mock from './mock';
import type {
  SpotifyTrack, SpotifyArtist, SpotifyAlbum, SpotifyPlaylist,
  SpotifyPlaylistItem, SpotifySearchResults, SpotifyPlaybackState,
  SpotifyUserProfile, SpotifyDeviceList, SpotifyQueueResponse,
  SpotifySavedTracks, SpotifySavedAlbums, SpotifyUserPlaylists,
  SpotifyCategory, SpotifyAudioFeatures, SpotifyAudioAnalysis,
  SpotifyArtistTopTracks,
} from '../types';

// ─── Configuration ───────────────────────────────────────────────────────────

const SCOPES = [
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'streaming', 'user-read-private', 'user-read-email', 'playlist-read-private',
  'playlist-read-collaborative', 'user-library-read', 'user-library-modify',
  'user-read-recently-played', 'user-top-read', 'user-follow-read',
].join(' ');

const REDIRECT_URI = (import.meta as any).env?.VITE_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:1422/callback';
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// ─── SDK Instance ─────────────────────────────────────────────────────────────

let sdkInstance: SpotifyApi | null = null;

function getClientId(): string {
  return (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID || 'e1c9ee463a394fee84e031daa1665db2';
}

function isBrowserMode(): boolean {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.__is_spx_shim__ === true;
}

function spotifyApiUrl(original: string): string {
  return isBrowserMode() ? original.replace(/^https:\/\/api\.spotify\.com/, '/spotify-api') : original;
}

function spotifyAccountsUrl(original: string): string {
  return isBrowserMode() ? original.replace(/^https:\/\/accounts\.spotify\.com/, '/spotify-accounts') : original;
}

function createSdk(accessToken: string): SpotifyApi {
  const config = isBrowserMode()
    ? {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString();
          const proxied = url.replace(/^https:\/\/api\.spotify\.com/, '/spotify-api');
          console.log(`[SDK proxy] ${url} -> ${proxied}`);
          return fetch(proxied, init).then(r => {
            console.log(`[SDK proxy] ${proxied} -> ${r.status}`);
            return r;
          }).catch(e => {
            console.error(`[SDK proxy] ${proxied} failed:`, e);
            throw e;
          });
        },
      }
    : undefined;
  sdkInstance = SpotifyApi.withAccessToken(getClientId(), { access_token: accessToken }, config);
  return sdkInstance;
}

function getSdk(): SpotifyApi {
  if (!sdkInstance) throw new Error('SDK not initialized. Call ensureValidToken first.');
  return sdkInstance;
}

// ─── Mock Mode ────────────────────────────────────────────────────────────────

const MOCK_ENABLED = import.meta.env?.VITE_SPX_MOCK === '1';

function isMockActive(): boolean {
  return MOCK_ENABLED || mock.isMockActive();
}

// ─── Token Storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'spx_spotify_token';

// Token refresh lock to prevent concurrent refresh attempts
let refreshingToken: Promise<boolean> | null = null;

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
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function getAccessToken(): string | null {
  const token = loadToken();
  if (!token || Date.now() >= token.expiresAt - 60000) return null;
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
  if (!token) return { present: false, expired: true, expiresAt: null, hasRefreshToken: false, preview: null };
  return {
    present: true,
    expired: Date.now() >= token.expiresAt - 60000,
    expiresAt: token.expiresAt,
    hasRefreshToken: !!token.refreshToken,
    preview: token.accessToken ? `${token.accessToken.slice(0, 6)}…${token.accessToken.slice(-6)}` : null,
  };
}

function clearStoredToken() { localStorage.removeItem(TOKEN_KEY); }
function isTokenExpired(token: StoredToken): boolean { return Date.now() >= token.expiresAt - 60000; }

// ─── PKCE Auth (External Browser) ─────────────────────────────────────────────

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  if (window.crypto?.subtle) return window.crypto.subtle.digest('SHA-256', data);
  return sha256Js(data);
}

// Pure-JS SHA-256 fallback
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
  function rotr(n: number, x: number) { return (x >>> n) | (x << (32 - n)); }
  function ch(x: number, y: number, z: number) { return (x & y) ^ (~x & z); }
  function maj(x: number, y: number, z: number) { return (x & y) ^ (x & z) ^ (y & z); }
  function sigma0(x: number) { return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x); }
  function sigma1(x: number) { return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x); }
  function gamma0(x: number) { return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3); }
  function gamma1(x: number) { return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10); }
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const totalBits = data.length * 8;
  const padLen = Math.ceil((totalBits + 65) / 512) * 64;
  const padded = new Uint8Array(padLen);
  padded.set(data); padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, totalBits, false);
  for (let i = 0; i < padLen; i += 64) {
    const w = new Uint32Array(64);
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) w[t] = (gamma1(w[t - 2]) + w[t - 7] + gamma0(w[t - 15]) + w[t - 16]) >>> 0;
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + sigma1(e) + ch(e, f, g) + k[t] + w[t]) >>> 0;
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      [a, b, c, d, e, f, g, hh] = [t1 + t2, a, b, c, d + t1, e, f, g];
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const result = new ArrayBuffer(32);
  const resultView = new DataView(result);
  for (let i = 0; i < 8; i++) resultView.setUint32(i * 4, h[i], false);
  return result;
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ─── Auth Methods ──────────────────────────────────────────────────────────────

export async function startAuthFlow(): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64encode(await sha256(codeVerifier));
  const state = generateRandomString(32);
  sessionStorage.setItem('pkce_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  // Save verifier to the Rust backend so it can do the token exchange.
  // The backend reads this file in /callback and exchanges the code server-side.
  if (isBrowserMode()) {
    try {
      await fetch('/save-verifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ state, verifier: codeVerifier }),
      });
    } catch (e) {
      console.warn('[Auth] Failed to save verifier to backend, continuing anyway:', e);
    }
  }

  const params = new URLSearchParams({
    client_id: getClientId(), response_type: 'code', redirect_uri: REDIRECT_URI,
    scope: SCOPES, code_challenge_method: 'S256', code_challenge: codeChallenge, state,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;
  const isBrowser = (window as any).__TAURI_INTERNALS__?.__is_spx_shim__ === true;
  if (isBrowser) { window.location.href = authUrl; return; }
  try { await open(authUrl); }
  catch { throw new Error('Failed to open browser. Please check your settings.'); }
}

export async function handleAuthCallback(code: string, state?: string): Promise<boolean> {
  const expectedState = sessionStorage.getItem('oauth_state');
  if (state && expectedState && state !== expectedState) {
    sessionStorage.removeItem('oauth_state');
    throw new Error('Invalid state parameter. Possible CSRF attack.');
  }
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('PKCE verifier not found. Please try again.');
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('pkce_verifier');

  const response = await fetch(spotifyAccountsUrl(TOKEN_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: getClientId(), grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Auth failed: ${error.error_description || error.error}`);
  }

  const data = await response.json();
  const token: StoredToken = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (data.expires_in * 1000) };
  saveToken(token);
  createSdk(token.accessToken);
  return true;
}

export async function refreshAccessToken(): Promise<boolean> {
  // If a refresh is already in progress, wait for it instead of starting another
  if (refreshingToken) {
    return refreshingToken;
  }

  const token = loadToken();
  if (!token?.refreshToken) return false;

  refreshingToken = (async () => {
    try {
      const response = await fetch(spotifyAccountsUrl(TOKEN_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: getClientId(), grant_type: 'refresh_token', refresh_token: token.refreshToken }),
      });
      if (!response.ok) { 
        clearStoredToken(); 
        return false; 
      }
      const data = await response.json();
      const newToken: StoredToken = { 
        accessToken: data.access_token, 
        refreshToken: data.refresh_token || token.refreshToken, 
        expiresAt: Date.now() + (data.expires_in * 1000) 
      };
      saveToken(newToken);
      createSdk(newToken.accessToken);
      return true;
    } catch { 
      return false; 
    } finally {
      refreshingToken = null;
    }
  })();

  return refreshingToken;
}

export function isAuthenticated(): boolean {
  const token = loadToken();
  return !!token && !isTokenExpired(token);
}

export async function ensureValidToken(): Promise<boolean> {
  const token = loadToken();
  console.log(`[ensureValidToken] Token exists: ${!!token}, expired: ${token ? isTokenExpired(token) : 'N/A'}`);
  if (!token) return false;
  if (isTokenExpired(token)) {
    console.log(`[ensureValidToken] Token expired, attempting refresh...`);
    if (token.refreshToken) return await refreshAccessToken();
    return false;
  }
  createSdk(token.accessToken);
  return true;
}

export function logout() {
  clearStoredToken();
  sdkInstance = null;
}

// ─── API Call Wrapper ──────────────────────────────────────────────────────────

// Extract status code from various error formats
function getErrorStatus(error: any): number | null {
  // Direct status
  if (typeof error?.status === 'number') return error.status;
  // HTTP response status
  if (typeof error?.response?.status === 'number') return error.response.status;
  if (typeof error?.statusCode === 'number') return error.statusCode;
  // Spotify API error format { error: { status: N, ... } }
  if (typeof error?.error?.status === 'number') return error.error.status;
  return null;
}

// Get error message from various formats
function getErrorMessage(error: any): string {
  if (typeof error?.message === 'string') return error.message;
  if (typeof error?.error?.message === 'string') return error.error.message;
  if (typeof error?.error?.reason === 'string') return error.error.reason;
  return String(error);
}

async function apiCall<T>(fn: () => Promise<T>): Promise<T> {
  if (isMockActive()) return fn() as any;
  const valid = await ensureValidToken();
  if (!valid) throw new Error('Not authenticated. Please sign in to Spotify.');
  try { return await fn(); }
  catch (error: any) {
    const status = getErrorStatus(error);
    const msg = getErrorMessage(error);
    
    if (status === 401) { clearStoredToken(); throw new Error('Session expired. Please sign in again.'); }
    if (status === 403) throw new Error(`Access denied (403). ${msg}`);
    if (status === 404) throw new Error('Not found. The requested content may have been removed.');
    if (status === 429) throw new Error('Too many requests. Please wait and try again.');
    if (status === 400) throw new Error(`Bad request (400). ${msg}`);
    
    // Include status in error message for debugging
    const errorMsg = status ? `Error ${status}: ${msg}` : msg;
    throw new Error(errorMsg);
  }
}

// ─── API Methods (Using Official SDK) ─────────────────────────────────────────

// Playback
export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  if (isMockActive()) return mock.mock.getPlaybackState();
  return apiCall(() => getSdk().player.getPlaybackState());
}

export async function play(deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.play(deviceId);
  return apiCall(() => getSdk().player.startResumePlayback(deviceId));
}

export async function pause(deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.pause(deviceId);
  return apiCall(() => getSdk().player.pausePlayback(deviceId));
}

export async function nextTrack(deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.nextTrack();
  return apiCall(() => getSdk().player.skipToNext(deviceId || ''));
}

export async function previousTrack(deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.previousTrack();
  return apiCall(() => getSdk().player.skipToPrevious(deviceId || ''));
}

export async function seek(positionMs: number, deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.seek(positionMs, deviceId);
  return apiCall(() => getSdk().player.seekToPosition(positionMs, deviceId));
}

export async function setVolume(volumePercent: number, deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.setVolume(volumePercent, deviceId);
  return apiCall(() => getSdk().player.setPlaybackVolume(volumePercent, deviceId));
}

export async function setShuffle(state: boolean, deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.toggleShuffle(state);
  return apiCall(() => getSdk().player.togglePlaybackShuffle(state, deviceId));
}

export async function setRepeat(state: 'off' | 'track' | 'context', deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.setRepeat(state);
  return apiCall(() => getSdk().player.setRepeatMode(state, deviceId));
}

export async function transferPlayback(deviceId: string, play = true): Promise<void> {
  if (isMockActive()) return mock.mock.transferPlayback(deviceId, play);
  
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');

  console.log(`[transferPlayback] Transferring to deviceId=${deviceId}, play=${play}`);
  
  // Use direct fetch with device_id as query parameter (more reliable than SDK method)
  // Research shows this helps avoid "no active device" errors
  const response = await fetch(
    spotifyApiUrl(`https://api.spotify.com/v1/me/player?device_id=${encodeURIComponent(deviceId)}`),
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play,
      }),
    }
  );

  if (!response.ok && response.status !== 204) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    const error = new Error(`Transfer playback failed: ${response.status} ${response.statusText} - ${errorBody}`);
    (error as any).statusCode = response.status;
    throw error;
  }

  console.log(`[transferPlayback] Success`);
}

export async function playContext(contextUri: string, offset?: number | string, deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.playContext(contextUri, undefined, deviceId);
  const offsetObject = typeof offset === 'number' ? { position: offset } : typeof offset === 'string' ? { uri: offset } : undefined;
  return apiCall(() => getSdk().player.startResumePlayback(deviceId, contextUri, undefined, offsetObject));
}

export async function playUris(uris: string[], offset?: number, deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.playUris(uris, offset, deviceId);
  const offsetObject = typeof offset === 'number' ? { position: offset } : undefined;
  return apiCall(() => getSdk().player.startResumePlayback(deviceId, undefined, uris, offsetObject));
}

export async function addToQueue(uri: string, deviceId?: string): Promise<void> {
  if (isMockActive()) return mock.mock.addToQueue(uri, deviceId);
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');
  await fetch(spotifyApiUrl(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}${deviceId ? '&device_id=' + deviceId : ''}`), {
    method: 'POST', headers: { 'Authorization': `Bearer ${token.accessToken}` }
  });
}

// User & Library
export async function getCurrentUser(): Promise<SpotifyUserProfile> {
  if (isMockActive()) return mock.mock.getCurrentUser();
  return apiCall(() => getSdk().currentUser.profile());
}

export async function getUserPlaylists(limit = 50, offset = 0): Promise<SpotifyUserPlaylists> {
  if (isMockActive()) return mock.mock.getUserPlaylists();
  return apiCall(() => getSdk().currentUser.playlists.playlists(limit, offset));
}

export async function getMySavedTracks(limit = 50, offset = 0): Promise<SpotifySavedTracks> {
  if (isMockActive()) return mock.mock.getMySavedTracks();
  return apiCall(() => getSdk().currentUser.savedTracks.tracks(limit, offset));
}

export async function getMySavedAlbums(limit = 50, offset = 0): Promise<SpotifySavedAlbums> {
  if (isMockActive()) return mock.mock.getMySavedAlbums();
  return apiCall(() => getSdk().currentUser.savedAlbums.albums(limit, offset));
}

export async function getMyTop(type: 'artists' | 'tracks', timeRange = 'medium_term', limit = 50): Promise<SpotifyArtist[] | SpotifyTrack[]> {
  if (isMockActive()) return mock.mock.getMyTop(type, timeRange, limit) as any;
  if (type === 'artists') {
    const result = await apiCall(() => getSdk().currentUser.topItems('artists', timeRange, limit));
    return result.items;
  } else {
    const result = await apiCall(() => getSdk().currentUser.topItems('tracks', timeRange, limit));
    return result.items;
  }
}

export async function getMyRecentlyPlayed(): Promise<{ items: Array<{ track: SpotifyTrack; played_at: string }> }> {
  if (isMockActive()) return mock.mock.getMyRecentlyPlayed();
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(spotifyApiUrl('https://api.spotify.com/v1/me/player/recently-played?limit=50'), {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  if (!response.ok) throw new Error(`Failed to get recently played: ${response.status}`);
  return response.json() as Promise<{ items: Array<{ track: SpotifyTrack; played_at: string }> }>;
}

export async function getMyFollowedArtists(limit = 50, after?: string): Promise<SpotifyArtist[]> {
  if (isMockActive()) return mock.mock.getMyFollowedArtists();
  const result = await apiCall(() => getSdk().currentUser.followedArtists(after, limit));
  return result.artists.items;
}

// Browse
export async function getNewReleases(limit = 50, offset = 0): Promise<SpotifyAlbum[]> {
  if (isMockActive()) return mock.mock.getNewReleases();
  const result = await apiCall(() => getSdk().browse.getNewReleases(undefined, limit, offset));
  return result.albums.items;
}

export async function getCategories(limit = 50, offset = 0): Promise<SpotifyCategory[]> {
  if (isMockActive()) return mock.mock.getCategories();
  const result = await apiCall(() => getSdk().browse.getCategories(undefined, undefined, limit, offset));
  return result.categories.items;
}

export async function getCategoryPlaylists(categoryId: string, limit = 50, offset = 0): Promise<SpotifyPlaylist[]> {
  if (isMockActive()) return mock.mock.getCategoryPlaylists(categoryId);
  const result = await apiCall(() => getSdk().browse.getPlaylistsForCategory(categoryId, undefined, limit, offset));
  return result.playlists.items;
}

export interface RecommendationsOptions {
  seedTracks?: string[]; seedArtists?: string[]; seedGenres?: string[];
  limit?: number; minEnergy?: number; minValence?: number;
}

export async function getRecommendations(options: RecommendationsOptions = {}): Promise<{ tracks: SpotifyTrack[] }> {
  if (isMockActive()) return mock.mock.getRecommendations(options);
  const result = await apiCall(() => getSdk().browse.recommendations({
    seed_tracks: options.seedTracks?.slice(0, 5),
    seed_artists: options.seedArtists?.slice(0, 5),
    seed_genres: options.seedGenres?.slice(0, 5),
    limit: options.limit || 20,
  }));
  return { tracks: result.tracks };
}

// Search
export async function search(query: string, types: ('album' | 'artist' | 'playlist' | 'track')[] = ['track', 'album', 'artist', 'playlist'], limit = 50): Promise<SpotifySearchResults> {
  if (isMockActive()) return mock.mock.search(query);
  return apiCall(() => getSdk().search(query, types, undefined, limit));
}

// Playlists
export async function getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
  if (isMockActive()) return mock.mock.getPlaylist(playlistId);
  return apiCall(() => getSdk().playlists.getPlaylist(playlistId));
}

export async function getPlaylistTracks(playlistId: string, limit = 100, offset = 0): Promise<{ items: Array<SpotifyPlaylistItem>; total: number }> {
  if (isMockActive()) return mock.mock.getPlaylistTracks(playlistId, limit, offset);
  const result = await apiCall(() => getSdk().playlists.getPlaylistItems(playlistId, undefined, undefined, limit, offset));
  return { items: result.items, total: result.total };
}

// Albums
export async function getAlbum(albumId: string): Promise<SpotifyAlbum> {
  if (isMockActive()) return mock.mock.getAlbum(albumId);
  return apiCall(() => getSdk().albums.get(albumId));
}

export async function getAlbumTracks(albumId: string, limit = 50, offset = 0): Promise<{ items: SpotifyTrack[]; total: number }> {
  if (isMockActive()) return mock.mock.getAlbumTracks(albumId);
  const result = await apiCall(() => getSdk().albums.tracks(albumId, undefined, limit, offset));
  return { items: result.items, total: result.total };
}

export async function getAlbums(ids: string[]): Promise<SpotifyAlbum[]> {
  if (isMockActive()) return mock.mock.getAlbums(ids);
  return apiCall(() => getSdk().albums.get(ids));
}

// Artists
export async function getArtist(artistId: string): Promise<SpotifyArtist> {
  if (isMockActive()) return mock.mock.getArtist(artistId);
  return apiCall(() => getSdk().artists.get(artistId));
}

export async function getArtistTopTracks(artistId: string, country = 'US'): Promise<SpotifyArtistTopTracks> {
  if (isMockActive()) return mock.mock.getArtistTopTracks(artistId, country);
  return apiCall(() => getSdk().artists.topTracks(artistId, country));
}

export async function getArtistAlbums(artistId: string, options?: { album_type?: string; limit?: number; offset?: number }): Promise<{ items: SpotifyAlbum[]; total: number }> {
  if (isMockActive()) return mock.mock.getArtistAlbums(artistId, options);
  const result = await apiCall(() => getSdk().artists.albums(artistId, options?.album_type, undefined, options?.limit, options?.offset));
  return { items: result.items, total: result.total };
}

export async function getArtistRelatedArtists(artistId: string): Promise<{ artists: SpotifyArtist[] }> {
  if (isMockActive()) return mock.mock.getArtistRelatedArtists(artistId);
  return apiCall(() => getSdk().artists.relatedArtists(artistId));
}

export async function getArtists(ids: string[]): Promise<SpotifyArtist[]> {
  if (isMockActive()) return mock.mock.getArtists(ids);
  return apiCall(() => getSdk().artists.get(ids));
}

// Tracks
export async function getTrack(trackId: string): Promise<SpotifyTrack> {
  if (isMockActive()) return mock.mock.getTrack(trackId);
  return apiCall(() => getSdk().tracks.get(trackId));
}

export async function getTracks(ids: string[]): Promise<SpotifyTrack[]> {
  if (isMockActive()) return mock.mock.getTracks(ids);
  return apiCall(() => getSdk().tracks.get(ids));
}

export async function getAudioFeatures(trackId: string): Promise<SpotifyAudioFeatures | null> {
  if (isMockActive()) return mock.mock.getAudioFeatures(trackId);
  return apiCall(() => getSdk().tracks.audioFeatures(trackId));
}

export async function getAudioFeaturesMultiple(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
  if (isMockActive()) return mock.mock.getAudioFeaturesMultiple(trackIds);
  return apiCall(() => getSdk().tracks.audioFeatures(trackIds));
}

export async function getAudioAnalysis(trackId: string): Promise<SpotifyAudioAnalysis> {
  if (isMockActive()) return mock.mock.getAudioAnalysis(trackId);
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(spotifyApiUrl(`https://api.spotify.com/v1/audio-analysis/${trackId}`), {
    headers: { 'Authorization': `Bearer ${token.accessToken}` }
  });
  if (!response.ok) throw new Error(`Failed to get audio analysis: ${response.status}`);
  return response.json() as Promise<SpotifyAudioAnalysis>;
}

// Library Actions
export async function saveTracks(ids: string[]): Promise<void> {
  if (isMockActive()) return mock.mock.saveTracks(ids);
  return apiCall(() => getSdk().currentUser.savedTracks.saveTracks(ids));
}

export async function removeSavedTracks(ids: string[]): Promise<void> {
  if (isMockActive()) return mock.mock.removeTracks(ids);
  return apiCall(() => getSdk().currentUser.savedTracks.removeTracks(ids));
}

export async function checkSavedTracks(ids: string[]): Promise<boolean[]> {
  if (isMockActive()) return mock.mock.checkSavedTracks(ids);
  return apiCall(() => getSdk().currentUser.savedTracks.containsTracks(ids));
}

// Playlist Follow Actions
export async function followPlaylist(playlistId: string): Promise<void> {
  if (isMockActive()) return;
  return apiCall(() => getSdk().currentUser.playlists.follow(playlistId));
}

export async function unfollowPlaylist(playlistId: string): Promise<void> {
  if (isMockActive()) return;
  return apiCall(() => getSdk().currentUser.playlists.unfollow(playlistId));
}

export async function checkFollowedPlaylists(playlistId: string, ids: string[]): Promise<boolean[]> {
  if (isMockActive()) return ids.map(() => false);
  return apiCall(() => getSdk().currentUser.playlists.isFollowing(playlistId, ids));
}

// Artist Follow Actions
export async function followArtists(ids: string[]): Promise<void> {
  if (isMockActive()) return;
  return apiCall(() => getSdk().currentUser.followArtistsOrUsers(ids, 'artist'));
}

export async function unfollowArtists(ids: string[]): Promise<void> {
  if (isMockActive()) return;
  return apiCall(() => getSdk().currentUser.followArtistsOrUsers(ids, 'artist'));
}

export async function checkFollowedArtists(ids: string[]): Promise<boolean[]> {
  if (isMockActive()) return ids.map(() => false);
  return apiCall(() => getSdk().currentUser.followsArtistsOrUsers(ids, 'artist'));
}

// Devices
export async function getMyDevices(): Promise<SpotifyDeviceList> {
  if (isMockActive()) return mock.mock.getMyDevices();
  return apiCall(() => getSdk().player.getAvailableDevices());
}

/** Direct API fallback — bypasses the Web Playback SDK which may return stale
 *  results in headless environments. Uses fetch + Bearer token directly. */
export async function getMyDevicesDirect(): Promise<SpotifyDeviceList> {
  if (isMockActive()) return mock.mock.getMyDevices();
  const token = loadToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(
    spotifyApiUrl('https://api.spotify.com/v1/me/player/devices'),
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );
  if (!response.ok) throw new Error(`getMyDevices failed: ${response.status}`);
  return response.json();
}

// Queue
export async function getMyQueue(): Promise<SpotifyQueueResponse> {
  if (isMockActive()) return mock.mock.getMyQueue();
  const valid = await ensureValidToken();
  if (!valid) throw new Error('Not authenticated');
  const token = loadToken();
  const response = await fetch(spotifyApiUrl('https://api.spotify.com/v1/me/player/queue'), {
    headers: { 'Authorization': `Bearer ${token?.accessToken}` }
  });
  if (!response.ok) throw new Error(`Failed to get queue: ${response.status}`);
  return response.json() as Promise<SpotifyQueueResponse>;
}

// Legacy alias
export async function addTracksToPlaylist(_playlistId: string, uris: string[], deviceId?: string): Promise<void> {
  for (const uri of uris) await addToQueue(uri, deviceId);
}

// Tauri helper delegation — extracted to ./tauri-invoke.ts so it can be vi.mock'd in tests.
export { tauriInvoke, setSpxBackendUrl } from './tauri-invoke';
import { tauriInvoke, setSpxBackendUrl } from './tauri-invoke';

// ─── Backward Compatibility ────────────────────────────────────────────────────

export const checkMockMode = isAuthenticated;
export const isMockMode = isMockActive;
export const restoreSession = async () => isAuthenticated();
export const validateToken = async () => isAuthenticated();
export const ensureTokenFresh = async () => isMockActive() || isAuthenticated();
export const clearToken = logout;
export const getUserProfile = getCurrentUser;
export const getFollowedArtists = getMyFollowedArtists;
export const getTopArtists = (limit = 20, timeRange = 'short_term') => getMyTop('artists', timeRange, limit) as any;
export const getTopTracks = (limit = 20, timeRange = 'short_term') => getMyTop('tracks', timeRange, limit) as any;
export const getRecentlyPlayedTracks = getMyRecentlyPlayed;
export const getBrowseCategories = getCategories;
export const getSavedTracks = getMySavedTracks;
export const getSavedAlbums = getMySavedAlbums;
export const getAvailableDevices = getMyDevices;
export const getQueue = getMyQueue;
export const next = nextTrack;
export const previous = previousTrack;

export async function scanLocalDevices(): Promise<Array<{ name: string; ip: string; port: number; id?: string; friendly_name?: string; service_type?: string }>> {
  if (isMockActive()) return [];

  // Browser mode: ask the local Node backend to scan mDNS for us.
  // The browser cannot send multicast packets, so we delegate to the
  // SPX browser backend running on 127.0.0.1:1422.
  if (isBrowserMode()) {
    // Use relative URL so Vite dev-server proxy forwards to the Rust backend.
    // In production (built SPA served by any HTTP server) this falls back to
    // the absolute URL if the relative path doesn't resolve.
    // mDNS scan can take up to ~20s; set a 30s browser-side timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch('/local-devices', {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Backend scan failed: ${res.status}`);
      return (await res.json()).devices ?? [];
    } catch (e) {
      clearTimeout(timer);
      console.warn('[scanLocalDevices] Browser backend scan failed:', e);
      return [];
    }
  }

  // Desktop mode: Rust backend has direct network access.
  try {
    const result = await tauriInvoke<any[]>('scan_spotify_devices');
    return Array.isArray(result) ? result : [];
  }
  catch { return []; }
}

// SDK Object Export
export const spotifySdk = {
  startAuthFlow, handleAuthCallback, refreshAccessToken, isAuthenticated, logout,
  getPlaybackState, play, pause, nextTrack, previousTrack, seek, setVolume,
  setShuffle, setRepeat, transferPlayback, playContext, playUris, addToQueue,
  getCurrentUser, getUserPlaylists, getMySavedTracks, getMySavedAlbums, getMyTop,
  getMyRecentlyPlayed, getMyFollowedArtists,
  getNewReleases, getCategories, getCategoryPlaylists, getRecommendations,
  search,
  getPlaylist, getPlaylistTracks,
  getAlbum, getAlbumTracks, getAlbums,
  getArtist, getArtistTopTracks, getArtistAlbums, getArtistRelatedArtists, getArtists,
  getTrack, getTracks, getAudioFeatures, getAudioFeaturesMultiple, getAudioAnalysis,
  saveTracks, removeSavedTracks, checkSavedTracks,
  getMyDevices,
  getMyQueue,
};
