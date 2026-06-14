import * as ws from "./ws-client";

// ─── Auth State ───────────────────────────────────────────────

let accessToken: string | null = null;
let _tokenCache: any = null;
let mockModeValue = false;
let mockModeChecked = false;

const TOKEN_STORAGE_KEY = "spx_spotify_token";
const REDIRECT_URI = "http://127.0.0.1:1422/callback";
const REQUIRED_SCOPES = [
  "streaming", "user-read-recently-played", "user-read-playback-state",
  "user-modify-playback-state", "user-read-currently-playing",
  "playlist-read-private", "user-read-private", "user-library-read",
  "user-library-modify", "user-top-read", "user-follow-read",
];

function isTauri(): boolean {
  return typeof window !== "undefined"
    && "__TAURI_INTERNALS__" in window
    && !(window as any).__TAURI_INTERNALS__.__is_spx_shim__;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error("Not in Tauri");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function getStore() {
  if (isTauri()) {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      return await load("spotify-auth.bin");
    } catch {
      // fall through to localStorage
    }
  }
  return {
    get: async (key: string) => { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; },
    set: async (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val)),
    delete: async (key: string) => localStorage.removeItem(key),
    clear: async () => localStorage.clear(),
    save: async () => {},
  };
}

// ─── Mock Mode ────────────────────────────────────────────────

export async function checkMockMode(): Promise<boolean> {
  if (mockModeChecked) return mockModeValue;
  try { if (isTauri()) mockModeValue = await tauriInvoke<boolean>("is_mock_mode"); } catch {}
  mockModeValue = mockModeValue || (typeof import.meta.env !== "undefined" && import.meta.env.VITE_SPX_MOCK === "1");
  mockModeChecked = true;
  return mockModeValue;
}

function isMockMode(): boolean { return mockModeValue; }

// ─── Token Management ─────────────────────────────────────────

async function saveToken(token: any) {
  _tokenCache = { ...token, expires_at: Date.now() + (token.expires_in * 1000) - 60000 };
  accessToken = token.access_token;
  const store = await getStore();
  await store.set(TOKEN_STORAGE_KEY, _tokenCache);
  await store.save();
}

async function loadToken(): Promise<any | null> {
  if (_tokenCache) { accessToken = _tokenCache.access_token; return _tokenCache; }
  try {
    const store = await getStore();
    const stored = await store.get(TOKEN_STORAGE_KEY);
    if (stored) { _tokenCache = stored; accessToken = stored.access_token; return stored; }
  } catch {}
  return null;
}

export async function clearToken() {
  _tokenCache = null; accessToken = null;
  try { const store = await getStore(); await store.delete(TOKEN_STORAGE_KEY); await store.save(); } catch {}
}

export function getAccessToken(): string | null { return accessToken; }

// ─── Auth Flow ────────────────────────────────────────────────

function sha256(data: Uint8Array): ArrayBuffer {
  let hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const blen = data.length * 8;
  const padLen = (((data.length + 9 + 63) >> 6) << 6);
  const p = new Uint8Array(padLen);
  p.set(data); p[data.length] = 0x80;
  const dv = new DataView(p.buffer);
  dv.setUint32(padLen - 8, 0, false); dv.setUint32(padLen - 4, blen, false);
  const W = new Uint32Array(64);
  for (let c = 0; c < padLen; c += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(c + i * 4, false);
    for (let i = 16; i < 64; i++) W[i] = (W[i - 16] + ((W[i - 15] >>> 7) ^ (W[i - 15] >>> 18) ^ (W[i - 15] >>> 3)) + W[i - 7] + ((W[i - 2] >>> 17) ^ (W[i - 2] >>> 19) ^ (W[i - 2] >>> 10))) >>> 0;
    let [a, b, c2, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      let t1 = (h + ((e >>> 6) ^ (e >>> 11) ^ (e >>> 25)) + ((e & f) ^ ((~e) & g)) + K[i] + W[i]) >>> 0;
      let t2 = (((a >>> 2) ^ (a >>> 13) ^ (a >>> 22)) + ((a & b) ^ (a & c2) ^ (b & c2))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c2; c2 = b; b = a; a = (t1 + t2) >>> 0;
    }
    hash = hash.map((v, i) => (v + [a, b, c2, d, e, f, g, h][i]) >>> 0);
  }
  const r = new Uint8Array(32);
  const rd = new DataView(r.buffer);
  for (let i = 0; i < 8; i++) rd.setUint32(i * 4, hash[i], false);
  return r.buffer;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  let hashBuffer: ArrayBuffer;
  try { hashBuffer = await crypto.subtle.digest("SHA-256", data); } catch { hashBuffer = sha256(data); }
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getClientId(): Promise<string> {
  let id = typeof import.meta.env !== "undefined" ? (import.meta.env.VITE_SPOTIFY_CLIENT_ID || null) : null;
  if (id) return id;
  if (isTauri()) id = await tauriInvoke<string>("get_spotify_client_id");
  if (!id) throw new Error("SPOTIFY_CLIENT_ID must be set");
  return id;
}

let tokenVerifier: string | null = null;

// Store verifier + state in sessionStorage so it survives same-origin redirect
function getStoredVerifier(): string | null { try { return sessionStorage.getItem("spx_pkce_verifier"); } catch { return null; } }
function setStoredVerifier(v: string) { try { sessionStorage.setItem("spx_pkce_verifier", v); } catch {} }
function clearStoredVerifier() { try { sessionStorage.removeItem("spx_pkce_verifier"); } catch {} }
function getStoredState(): string | null { try { return sessionStorage.getItem("spx_pkce_state"); } catch { return null; } }
function setStoredState(s: string) { try { sessionStorage.setItem("spx_pkce_state", s); } catch {} }
function clearStoredState() { try { sessionStorage.removeItem("spx_pkce_state"); } catch {} }

export async function getAuthUrl(): Promise<string> {
  const id = await getClientId();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier().slice(0, 16);
  setStoredVerifier(verifier);
  setStoredState(state);
  const params = new URLSearchParams({
    response_type: "code", client_id: id,
    scope: REQUIRED_SCOPES.join(" "),
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256", code_challenge: challenge, state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/** Check if current page URL has a Spotify auth code and exchange it. Returns true if handled. */
export async function handleCallbackFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (error) { console.error("Spotify auth error:", error); return false; }
  if (!code) return false;
  const verifier = getStoredVerifier();
  const expectedState = getStoredState();
  const returnedState = params.get("state");
  if (expectedState && returnedState !== expectedState) throw new Error("OAuth state mismatch");
  if (!verifier) throw new Error("No PKCE verifier found in sessionStorage — did you start auth from this page?");
  tokenVerifier = verifier;
  clearStoredVerifier();
  clearStoredState();
  // Clean the URL
  window.history.replaceState({}, "", window.location.pathname);
  return exchangeCode(code);
}

export async function startAuthFlow(): Promise<void> {
  if (!isTauri()) throw new Error("Auth not supported in browser. Use the 'Connect' flow instead.");
  const serverPromise = tauriInvoke<[string, string] | null>("start_callback_server");
  const url = await getAuthUrl();
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
  const result = await serverPromise;
  if (!result) throw new Error("Auth timeout or cancelled");
  const [code, returnedState] = result;
  const expectedState = getStoredState();
  clearStoredState();
  if (expectedState && returnedState !== expectedState) throw new Error("OAuth state mismatch");
  tokenVerifier = getStoredVerifier();
  clearStoredVerifier();
  await exchangeCode(code);
}

export async function exchangeCode(code: string): Promise<boolean> {
  if (!tokenVerifier) throw new Error("No verifier available");
  const id = await getClientId();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code,
      redirect_uri: REDIRECT_URI, client_id: id,
      code_verifier: tokenVerifier,
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed: HTTP ${response.status}`);
  const data = await response.json();
  accessToken = data.access_token;
  await saveToken(data);
  const grantedScopes = (data.scope ?? "").split(" ").filter(Boolean);
  if (REQUIRED_SCOPES.some(s => !grantedScopes.includes(s))) {
    console.warn("[Auth] Missing scopes");
    await clearToken();
    return false;
  }
  initBackend();
  return true;
}

async function initBackend() {
  const tokenStr = JSON.stringify(_tokenCache);
  ws.connect();
  try { await ws.send("init", { token: tokenStr }); } catch (e) { console.warn("Backend init failed:", e); }
}

async function refreshAccessToken(refreshToken: string): Promise<boolean> {
  try {
    const clientId = await getClientId();
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data.refresh_token) data.refresh_token = refreshToken;
    accessToken = data.access_token;
    await saveToken(data);
    initBackend();
    return true;
  } catch { return false; }
}

export async function handleCallbackUrl(url: string): Promise<boolean> {
  const normalizedUrl = url.replace("com.spx.app://callback", "http://callback");
  const urlObj = new URL(normalizedUrl);
  const code = urlObj.searchParams.get("code");
  if (!code || !tokenVerifier) throw new Error("No authorization code");
  return exchangeCode(code);
}

export async function isAuthenticated(): Promise<boolean> {
  await checkMockMode();
  if (mockModeValue) return true;
  if (!!accessToken) return true;
  const token = await loadToken();
  return !!token?.access_token;
}

export async function restoreSession(): Promise<boolean> {
  const envToken = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_SPOTIFY_ACCESS_TOKEN : null;
  if (envToken) {
    accessToken = envToken;
    ws.connect();
    return true;
  }
  const token = await loadToken();
  if (!token?.access_token) return false;
  accessToken = token.access_token;
  const isExpired = token.expires_at ? Date.now() > token.expires_at : true;
  if (isExpired && token.refresh_token) {
    const refreshed = await refreshAccessToken(token.refresh_token);
    if (!refreshed) { await clearToken(); return false; }
  }
  if (isExpired && !token.refresh_token) { await clearToken(); return false; }
  ws.connect();
  if (ws.isConnected()) await initBackend();
  else {
    const checkConn = setInterval(async () => {
      if (ws.isConnected()) { clearInterval(checkConn); await initBackend(); }
    }, 500);
  }
  return true;
}

export async function logout() {
  accessToken = null; tokenVerifier = null;
  await clearToken();
  ws.disconnect();
  try { const { stopPlaybackPolling } = await import("../stores/playback"); stopPlaybackPolling(); } catch {}
  try { const { clearStore } = await import("../stores/spotify"); clearStore(); } catch {}
  try { const { clearDeviceSelection } = await import("../stores/devices"); clearDeviceSelection(); } catch {}
  try { const { clearCache } = await import("./cache"); await clearCache(); } catch {}
}

// ─── Mock Data ────────────────────────────────────────────────

const mockTrack = {
  id: "mock-track-1", name: "Mock Song",
  artists: [{ name: "Mock Artist", id: "mock-artist-1" }],
  album: { name: "Mock Album", images: [{ url: "" }] },
  duration_ms: 180000, uri: "spotify:track:mock",
};
let mockState = {
  item: mockTrack, progress_ms: 45000, is_playing: true,
  shuffle_state: false, repeat_state: "off",
  device: { id: "mock-dev", name: "This Computer", type: "computer", volume_percent: 74, is_active: true },
};
const mockUser = { display_name: "Mock User", images: [{ url: "" }] };
const mockPlaylists = { items: [{ id: "mock-pl-1", name: "My Playlist", images: [{ url: "" }], tracks: { total: 10 }, owner: { display_name: "Mock User" } }] };
const mockQueue = { queue: [mockTrack] };

// ─── WS Client Wrapper ────────────────────────────────────────

async function apiCall(action: string, params: Record<string, unknown> = {}): Promise<any> {
  if (isMockMode()) {
    switch (action) {
      case "get_playback": return mockState;
      case "play": mockState.is_playing = true; return;
      case "pause": mockState.is_playing = false; return;
      case "next": case "prev": mockState.progress_ms = 0; return;
      case "seek": mockState.progress_ms = (params.position_ms as number) || 0; return;
      case "volume": mockState.device.volume_percent = (params.percent as number) || 50; return;
      case "shuffle": mockState.shuffle_state = !!params.state; return;
      case "repeat": mockState.repeat_state = (params.mode as string) || "off"; return;
      case "get_devices": return [{ id: "mock-dev", name: "This Computer", device_type: "computer", is_active: true, volume: 74 }];
      case "get_user_profile": return mockUser;
      case "get_playlists": return mockPlaylists;
      case "get_queue": return mockQueue;
      case "get_playlist": return { id: params.id, name: "Mock Playlist", images: [], tracks: { items: [] }, owner: { display_name: "Mock" } };
      case "get_playlist_tracks": return [];
      case "get_album": return { id: params.id, name: "Mock Album", artists: [{ name: "Mock Artist" }], images: [], tracks: { items: [] } };
      case "get_artist": return { id: params.id, name: "Mock Artist", genres: ["pop"], images: [], followers: { total: 0 } };
      case "get_artist_top_tracks": return [];
      case "get_artist_albums": return [];
      case "search": return { tracks: { items: [] }, albums: { items: [] }, artists: { items: [] }, playlists: { items: [] } };
      case "get_recently_played": return { items: [] };
      case "get_top_artists": return [];
      case "get_top_tracks": return [];
      case "get_followed_artists": return { artists: { items: [] } };
      case "get_new_releases": return { albums: { items: [] } };
      case "get_categories": return { categories: { items: [] } };
      case "get_recommendations": return { tracks: [] };
      case "check_saved_tracks": return [false];
      case "save_tracks": case "remove_saved_tracks": return;
      case "validate_token": return true;
      default: return {};
    }
  }
  const resp = await ws.send(action, params);
  if (!resp.ok) throw new Error(resp.error || `Action failed: ${action}`);
  return resp.data;
}

// ─── API Functions (all routed through WebSocket) ─────────────

export async function getPlaybackState() { return apiCall("get_playback"); }
export async function play() { return apiCall("play"); }
export async function pause() { return apiCall("pause"); }
export async function next() { return apiCall("next"); }
export async function previous() { return apiCall("prev"); }
export async function seek(positionMs: number) { return apiCall("seek", { position_ms: positionMs }); }
export async function setVolume(volumePercent: number) { return apiCall("volume", { percent: volumePercent }); }
export async function getAvailableDevices() { return apiCall("get_devices"); }
export async function transferPlayback(deviceId: string, play?: boolean) { return apiCall("transfer", { device_id: deviceId, play: play ?? true }); }
export async function getQueue() { return apiCall("get_queue"); }
export async function getUserPlaylists() { return apiCall("get_playlists"); }
export async function getPlaylist(playlistId: string) { return apiCall("get_playlist", { id: playlistId }); }
export async function getPlaylistTracks(playlistId: string) { return apiCall("get_playlist_tracks", { id: playlistId }); }
export async function getRecentlyPlayedTracks(limit?: number) { return apiCall("get_recently_played", { limit: limit ?? 50 }); }
export async function search(query: string) { return apiCall("search", { query }); }
export async function getUserProfile() { return apiCall("get_user_profile"); }
export async function getAlbum(albumId: string) { return apiCall("get_album", { id: albumId }); }
export async function getArtist(artistId: string) { return apiCall("get_artist", { id: artistId }); }
export async function getArtistTopTracks(artistId: string) { return apiCall("get_artist_top_tracks", { id: artistId }); }
export async function getArtistAlbums(artistId: string) { return apiCall("get_artist_albums", { id: artistId }); }
export async function getArtistRelatedArtists(artistId: string) { return apiCall("get_artist", { id: artistId }); }
export async function checkSavedTracks(trackIds: string[]) { return apiCall("get_saved_tracks", { ids: trackIds }); }
export async function saveTracks(trackIds: string[]) { return apiCall("save_tracks", { ids: trackIds }); }
export async function removeSavedTracks(trackIds: string[]) { return apiCall("remove_saved_tracks", { ids: trackIds }); }
export async function getFollowedArtists() { return apiCall("get_followed_artists"); }
export async function getTopArtists(limit?: number, timeRange?: string) { return apiCall("get_top_artists", { limit: limit ?? 20, time_range: timeRange ?? "short_term" }); }
export async function getTopTracks(limit?: number, timeRange?: string) { return apiCall("get_top_tracks", { limit: limit ?? 20, time_range: timeRange ?? "short_term" }); }
export async function setShuffle(state: boolean) { return apiCall("shuffle", { state }); }
export async function setRepeat(state: string) { return apiCall("repeat", { mode: state }); }
export async function playContext(contextUri: string, offsetUri?: string, deviceId?: string) {
  return apiCall("play_context", { uri: contextUri, offset_uri: offsetUri ?? "", device_id: deviceId ?? "" });
}
export async function playUris(uris: string[], offset?: number, deviceId?: string) {
  return apiCall("play_uris", { uris, offset: offset ?? -1, device_id: deviceId ?? "" });
}
export async function addTracksToPlaylist(playlistId: string, uris: string[]) {
  return apiCall("add_tracks_to_playlist", { playlist_id: playlistId, uris });
}
export async function getNewReleases(limit?: number) { return apiCall("get_new_releases", { limit: limit ?? 20 }); }
export async function getBrowseCategories(limit?: number) { return apiCall("get_categories", { limit: limit ?? 20 }); }
export async function getCategoryPlaylists(_categoryId: string, limit?: number) {
  return apiCall("get_categories", { limit: limit ?? 20 });
}
export async function getAudioFeatures(trackId: string) { return apiCall("get_audio_features", { id: trackId }); }
export async function getAudioAnalysis() { return null; }
export async function getRecommendations(options: any = {}) {
  return apiCall("get_recommendations", {
    seed_tracks: options.seedTracks ?? [],
    seed_artists: options.seedArtists ?? [],
    seed_genres: options.seedGenres ?? [],
    limit: options.limit ?? 20,
  });
}
export async function getSavedTracks() { return { items: [] as any[] }; }
export async function getSavedAlbums() {
  return apiCall("get_saved_albums", { limit: 20 });
}
export async function scanLocalDevices() {
  try {
    if (!isTauri()) return [];
    return tauriInvoke<Array<{ name: string; ip: string; port: number; id?: string; friendly_name?: string; service_type?: string; is_active?: boolean; canTransfer?: boolean; note?: string }>>("scan_spotify_devices");
  } catch { return []; }
}
export async function ensureTokenFresh() {}
export async function validateToken() {
  try { await apiCall("validate_token"); return true; } catch { return false; }
}

// ─── Exports for Cast / Diagnostics (Tauri invoke only) ───────

export { tauriInvoke };
