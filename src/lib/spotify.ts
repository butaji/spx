import * as ws from "./ws-client";

// ─── Auth State ───────────────────────────────────────────────

let accessToken: string | null = null;
let _tokenCache: any = null;
let mockModeValue = false;
let mockModeChecked = false;

const TOKEN_STORAGE_KEY = "spx_spotify_token";

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
  try { if (isTauri()) await tauriInvoke("clear_librespot_session"); } catch {}
  try { const store = await getStore(); await store.delete(TOKEN_STORAGE_KEY); await store.save(); } catch {}
}

export function getAccessToken(): string | null { return accessToken; }

// ─── Auth Flow ────────────────────────────────────────────────

type TokenInfo = { access_token: string; expires_in: number; expires_at?: number };

async function installToken(token: TokenInfo) {
  accessToken = token.access_token;
  _tokenCache = { access_token: token.access_token, expires_in: token.expires_in };
  await saveToken(_tokenCache);
  ws.connect();
  if (ws.isConnected()) await initBackend();
  else {
    const checkConn = setInterval(async () => {
      if (ws.isConnected()) { clearInterval(checkConn); await initBackend(); }
    }, 500);
  }
}

export async function startAuthFlow(): Promise<void> {
  if (!isTauri()) throw new Error("Auth not supported in browser. Use the Tauri app.");
  const token = await tauriInvoke<TokenInfo>("authenticate_librespot");
  await installToken(token);
}

async function initBackend() {
  const tokenStr = JSON.stringify(_tokenCache);
  ws.connect();
  try { await ws.send("init", { token: tokenStr }); } catch (e) { console.warn("Backend init failed:", e); }
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

  // Prefer a cached librespot session so the backend can refresh tokens.
  try {
    const token = await tauriInvoke<TokenInfo>("restore_librespot_session");
    await installToken(token);
    return true;
  } catch {
    // No cached librespot credentials; fall back to stored token.
  }

  const token = await loadToken();
  if (!token?.access_token) return false;
  accessToken = token.access_token;
  const isExpired = token.expires_at ? Date.now() > token.expires_at : true;
  if (isExpired) { await clearToken(); return false; }
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
  accessToken = null;
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
      case "get_category_playlists": return { playlists: { items: [] } };
      case "get_recommendations": return { tracks: [] };
      case "get_saved_tracks": return { items: [] };
      case "check_saved_tracks": return [false];
      case "get_artist_related_artists": return { artists: [] };
      case "get_audio_features": return {
        id: params.id,
        danceability: 0.5,
        energy: 0.5,
        key: 0,
        loudness: -10,
        mode: 1,
        speechiness: 0.05,
        acousticness: 0.5,
        instrumentalness: 0,
        liveness: 0.1,
        valence: 0.5,
        tempo: 120,
        duration_ms: 180000,
        time_signature: 4,
      };
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
export async function play(deviceId?: string) { return apiCall("play", deviceId ? { device_id: deviceId } : {}); }
export async function pause(deviceId?: string) { return apiCall("pause", deviceId ? { device_id: deviceId } : {}); }
export async function next() { return apiCall("next"); }
export async function previous() { return apiCall("prev"); }
export async function seek(positionMs: number, deviceId?: string) { return apiCall("seek", { position_ms: positionMs, device_id: deviceId ?? "" }); }
export async function setVolume(volumePercent: number, deviceId?: string) { return apiCall("volume", { percent: volumePercent, device_id: deviceId ?? "" }); }
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
export async function getArtistRelatedArtists(artistId: string) { return apiCall("get_artist_related_artists", { id: artistId }); }
export async function checkSavedTracks(trackIds: string[]) { return apiCall("check_saved_tracks", { ids: trackIds }); }
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
export async function getCategoryPlaylists(categoryId: string, limit?: number) {
  return apiCall("get_category_playlists", { category_id: categoryId, limit: limit ?? 20 });
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
export async function getSavedTracks(limit?: number, offset?: number) {
  return apiCall("get_saved_tracks", { limit: limit ?? 20, offset: offset ?? 0 });
}
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
