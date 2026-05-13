import { signal } from "@preact/signals";
import {
  getPlaybackState,
  getUserProfile,
  getUserPlaylists,
  getQueue,
  getArtist,
  getArtistTopTracks,
  getArtistAlbums,
  checkMockMode,
  restoreSession,
  getAccessToken,
  clearToken,
  play,
  pause,
  getRecentlyPlayedTracks,
  getPlaylist,
  getTopArtists,
  getTopTracks,
  getNewReleases,
  getBrowseCategories,
  getCategoryPlaylists,
  getFollowedArtists,
  getSavedAlbums,
  checkSavedTracks,
} from "../lib/spotify";

export { clearToken } from "../lib/spotify";
import { withRetry } from "../lib/retry";
import { getCached, setCache, isCacheFresh } from "../lib/cache";
import type { SpotifyArtist } from "../types";

// Types
export interface TrackInfo {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: { name: string; images: Array<{ url: string }> };
  duration_ms: number;
  uri: string;
}

// Playback state
export const playbackTrack = signal<TrackInfo | null>(null);
export const playbackVolume = signal<number>(100);
export const playbackShuffle = signal<boolean>(false);
export const playbackRepeat = signal<"off" | "context" | "track">("off");
export const playbackProgress = signal<number>(0);
export const playbackDuration = signal<number>(0);
export const isPlaying = signal<boolean>(false);
export const likedTrack = signal<boolean>(false);

// Auth state
export const authState = signal<boolean>(false);
export const isMockMode = signal<boolean>(false);
export const authError = signal<boolean>(false);
export const isAuthLoading = signal<boolean>(false);

// User state
export const userProfile = signal<{ name: string; image?: string } | null>(null);

// Content state
export const featuredPlaylists = signal<any[]>([]);
export const userPlaylists = signal<any[]>([]);
export const playbackQueue = signal<any[]>([]);
export const queueCurrentTrack = signal<any | null>(null);

// Artist state
export const currentArtist = signal<any | null>(null);
export const artistTopTracks = signal<any[]>([]);
export const artistAlbums = signal<any[]>([]);

// App state
export const appError = signal<string | null>(null);
export const navigationHistory = signal<any[]>([]);

// Recent containers
export interface RecentContainer {
  id: string;
  type: 'album' | 'playlist' | 'artist' | 'radio';
  name: string;
  images: { url: string }[];
  played_at: string;
  owner?: string;
  artistName?: string; // for albums
  playCount?: number;
  uri?: string;
}

export const recentContainers = signal<RecentContainer[]>([]);

// Top artists
export const topArtists = signal<SpotifyArtist[]>([]);

// Top tracks
export const topTracks = signal<any[]>([]);

// Followed artists
export const followedArtists = signal<SpotifyArtist[]>([]);

// Saved albums
export const savedAlbums = signal<any[]>([]);

// Category playlists (editorial content)
export const categoryPlaylists = signal<Array<{ id: string; name: string; image: string; uri: string }>>([]);

// New releases
export const newReleases = signal<any[]>([]);

// Home feed (Heavy Rotation)
export interface HomeFeedItem {
  id: string;
  name: string;
  image: string;
  type: 'artist' | 'album' | 'playlist' | 'radio';
  uri?: string;
  subtitle?: string;
}
export const homeFeed = signal<HomeFeedItem[]>([]);



// Last played track
export interface LastPlayedTrack {
  name: string;
  artistName: string;
  albumName: string;
  imageUrl: string;
  uri: string;
  played_at: string;
  artistId?: string;
  id?: string;
}

export const lastPlayedTrack = signal<LastPlayedTrack | null>(null);

export async function refreshLikedStatus(trackId?: string): Promise<void> {
  if (!trackId) {
    likedTrack.value = false;
    return;
  }
  try {
    const result = await checkSavedTracks([trackId]);
    likedTrack.value = result[0] ?? false;
  } catch (err) {
    console.warn('[Store] Failed to check liked status:', err);
    likedTrack.value = false;
  }
}

export async function loadTopArtists() {
  try {
    const artists = await getTopArtists(10, 'medium_term');
    topArtists.value = artists as SpotifyArtist[];
    console.log('[Store] Loaded', artists.length, 'top artists');
  } catch (err) {
    console.warn('[Store] Failed to load top artists:', err);
  }
}

export async function loadTopTracks() {
  try {
    const tracks = await getTopTracks(20, 'short_term');
    topTracks.value = tracks;
    console.log('[Store] Loaded', tracks.length, 'top tracks');
  } catch (err) {
    console.warn('[Store] Failed to load top tracks:', err);
  }
}

export async function loadFollowedArtists() {
  try {
    const artists = await getFollowedArtists(20);
    followedArtists.value = artists;
    console.log('[Store] Loaded', artists.length, 'followed artists');
  } catch (err) {
    console.warn('[Store] Failed to load followed artists:', err);
  }
}

export async function loadSavedAlbums() {
  try {
    const data = await getSavedAlbums(20);
    const albums = (data as any).items?.map((item: any) => item.album).filter(Boolean) ?? [];
    savedAlbums.value = albums;
    console.log('[Store] Loaded', albums.length, 'saved albums');
  } catch (err) {
    console.warn('[Store] Failed to load saved albums:', err);
  }
}

/**
 * Build the Recent home feed from top tracks.
 * Extracts unique albums from the user's short-term top tracks.
 */
export function buildHomeFeed() {
  const items: HomeFeedItem[] = [];
  // Source: albums from top tracks (the user's actual recent listening)
  const seenAlbums = new Set<string>();
  topTracks.value.forEach((track: any) => {
    if (track.album && !seenAlbums.has(track.album.id) && items.length < 8) {
      seenAlbums.add(track.album.id);
      items.push({
        id: track.album.id,
        name: track.album.name,
        image: track.album.images?.[0]?.url || '',
        type: 'album' as const,
        uri: track.album.uri,
        subtitle: track.artists?.map((a: any) => a.name).join(', ') || 'Album'
      });
    }
  });

  homeFeed.value = items;
  console.log('[Store] Built home feed:', items.length, 'items');
  items.forEach((item, i) => console.log(`  ${i+1}. [${item.type}] ${item.name}`));
}

/**
 * Build home feed directly from recent containers only.
 * This is the true "Recent" view matching Spotify's behavior.
 */
export function buildRecentFeed() {
  const items: HomeFeedItem[] = [];
  const seenIds = new Set<string>();

  for (const container of recentContainers.value.slice(0, 8)) {
    if (seenIds.has(container.id)) continue;
    seenIds.add(container.id);

    items.push({
      id: container.id,
      name: container.name,
      image: container.images?.[0]?.url || '',
      type: container.type as 'album' | 'playlist' | 'artist' | 'radio',
      uri: container.uri || `spotify:${container.type}:${container.id}`,
      subtitle: container.type === 'playlist' ? (container.owner || 'Playlist')
        : container.type === 'artist' ? 'Artist'
        : container.type === 'radio' ? 'Radio'
        : (container.artistName || 'Album'),
    });
  }

  homeFeed.value = items;
  console.log('[Store] Built RECENT feed:', items.length, 'items');
  items.forEach((item, i) => console.log(`  ${i+1}. [${item.type}] ${item.name}`));
}

/**
 * Load all data sources needed for the recent activity / home feed,
 * then build the feed. Call this from Home screen init.
 */
export async function loadRecentActivity(): Promise<void> {
  console.log('[RecentActivity] Loading top tracks...');
  await loadTopTracks();
  buildHomeFeed();
  console.log('[RecentActivity] Complete');
}

export async function loadCategoryPlaylists() {
  try {
    // Get categories like Pop, Hip-Hop, Jazz, etc.
    const categories = await getBrowseCategories(10);
    console.log('[Store] Loaded', categories.length, 'browse categories');

    // Get playlists from first 3 categories
    const allPlaylists: typeof categoryPlaylists.value = [];
    for (const category of categories.slice(0, 3)) {
      try {
        const playlists = await getCategoryPlaylists(category.id, 5);
        allPlaylists.push(...playlists.slice(0, 2)); // Take top 2 from each
      } catch (err) {
        console.warn('[Store] Failed to load category playlists:', category.id);
      }
    }

    categoryPlaylists.value = allPlaylists;
    console.log('[Store] Loaded', allPlaylists.length, 'category playlists');
  } catch (err) {
    console.warn('[Store] Failed to load browse categories:', err);
  }
}

export async function loadNewReleases() {
  try {
    const releases = await getNewReleases(10);
    newReleases.value = releases;
    console.log('[Store] Loaded', releases.length, 'new releases');
  } catch (err) {
    console.warn('[Store] Failed to load new releases:', err);
  }
}



const CACHE_TTL = {
  playlists: 5 * 60 * 1000,
  profile: 10 * 60 * 1000,
  queue: 30 * 1000,
  recentContainers: 2 * 60 * 1000,
  followedArtists: 10 * 60 * 1000,
  savedAlbums: 10 * 60 * 1000,
};
const RECENT_CACHE_KEY = 'recent_containers_v3'; // bumped to invalidate stale cache

// Internal polling state
let playbackPollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Validate token has required scopes (e.g. streaming for Web Playback SDK)
 * Returns true if valid, false if insufficient scopes (clears token on failure)
 */
export async function validateToken(): Promise<boolean> {
  const accessToken = getAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    // Token has insufficient scopes - need re-auth
    if (response.status === 403) {
      console.log("Token has insufficient scopes, clearing...");
      await clearToken();
      authState.value = false;
      return false;
    }

    // Auth error - invalid/expired token
    if (response.status === 401) {
      console.log("Token unauthorized, clearing...");
      await clearToken();
      authState.value = false;
      return false;
    }

    // Server error - token might be valid, just spotify is down
    if (response.status >= 500) {
      console.warn("Spotify API returned 5xx, assuming token is valid");
      return true; // Don't force re-auth on server errors
    }

    return response.ok;
  } catch (e) {
    // Network error - don't clear token, might be offline
    console.warn("Network error during token validation, assuming token is valid");
    return true;
  }
}

/**
 * Refresh playback state from Spotify API
 */
export async function refreshPlayback(): Promise<void> {
  try {
    const state = await withRetry(() => getPlaybackState());
    if (!state) return;

    const item = state.item as any;
    if (item) {
      playbackTrack.value = {
        id: item.id,
        name: item.name,
        artists: item.artists,
        album: item.album,
        duration_ms: item.duration_ms,
        uri: item.uri,
      };
      playbackDuration.value = item.duration_ms;
    }

    playbackProgress.value = state.progress_ms ?? 0;
    isPlaying.value = state.is_playing ?? false;
    playbackShuffle.value = state.shuffle_state ?? false;
    playbackRepeat.value = (state.repeat_state as "off" | "context" | "track") ?? "off";
    playbackVolume.value = state.device?.volume_percent ?? 100;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503") || msg.includes("Bad gateway")) {
      // Spotify server errors are transient, ignore
      return;
    }
    if (msg.includes("Not authenticated") || msg.includes("401")) {
      return; // Auth errors handled by validateToken
    }
    console.warn("Playback refresh issue:", msg);
  }
}

/**
 * Start polling for playback state changes
 * Returns cleanup function
 */
export function startPlaybackPolling(): () => void {
  if (playbackPollInterval) {
    clearInterval(playbackPollInterval);
  }

  refreshPlayback();
  playbackPollInterval = setInterval(() => {
    refreshPlayback().catch(() => {}); // Swallow errors, handled inside
  }, 1000);

  return () => {
    if (playbackPollInterval) {
      clearInterval(playbackPollInterval);
      playbackPollInterval = null;
    }
  };
}

/**
 * Load user profile from Spotify API
 */
export async function loadUserProfile(): Promise<void> {
  const cached = await getCached<any>('user_profile');
  if (cached) {
    userProfile.value = cached;
    if (await isCacheFresh('user_profile')) return;
  }

  try {
    const data = await withRetry(() => getUserProfile());
    const profile = { name: data.display_name, image: data.images?.[0]?.url };
    userProfile.value = profile;
    setCache('user_profile', profile, CACHE_TTL.profile);
  } catch (e) {
    console.warn('[Spotify] Failed to load profile:', e);
  }
}

/**
 * Load featured playlists from Spotify API
 */
export async function loadFeaturedPlaylists(): Promise<void> {
  // Featured playlists endpoint is deprecated (returns 404)
  // Skip API call to avoid error logging in console
  featuredPlaylists.value = [];
}

/**
 * Load user's playlists from Spotify API
 */
export async function loadUserPlaylists(): Promise<void> {
  const cached = await getCached<any[]>('user_playlists');
  if (cached && cached.length > 0) {
    userPlaylists.value = cached;
    if (await isCacheFresh('user_playlists')) return;
  }

  try {
    const playlists = await withRetry(() => getUserPlaylists());
    const items = (playlists as any).items ?? [];
    userPlaylists.value = items;
    setCache('user_playlists', items, CACHE_TTL.playlists);
  } catch (e) {
    console.warn('[Spotify] Failed to load playlists:', e);
  }
}

/**
 * Load queue from Spotify API
 */
export async function loadQueue(): Promise<void> {
  try {
    const queue = await getQueue();
    playbackQueue.value = queue.queue ?? [];
  } catch (e) {
    console.warn("Failed to load queue:", e);
    // Silently fail - appError not set for routine API failures
  }
}

/**
 * Load artist details, top tracks, and albums
 */
export async function loadArtist(artistId: string): Promise<void> {
  try {
    const [artist, topTracksResult, albumsResult] = await Promise.all([
      getArtist(artistId),
      getArtistTopTracks(artistId),
      getArtistAlbums(artistId),
    ]);

    currentArtist.value = artist;
    artistTopTracks.value = topTracksResult?.tracks ?? [];
    artistAlbums.value = albumsResult?.items ?? [];
  } catch (e) {
    console.warn("Failed to load artist:", e);
    // Silently fail - appError not set for routine API failures
  }
}

/**
 * Load recently played containers (albums and playlists)
 */
export async function loadRecentContainers(): Promise<void> {
  console.log('[Recent] loadRecentContainers called');

  // 1. Try cache first
  const cached = await getCached<RecentContainer[]>(RECENT_CACHE_KEY);
  console.log('[Recent] Cache hit:', !!cached, 'count:', cached?.length);
  if (cached && cached.length > 0) {
    console.log('[Recent] Using cached data:', cached.map(c => `${c.type}:${c.name}`));
    recentContainers.value = cached;
    if (await isCacheFresh(RECENT_CACHE_KEY)) {
      console.log('[Recent] Cache fresh, skipping API');
      const first = cached[0];
      lastPlayedTrack.value = {
        name: first.name,
        artistName: first.artistName || '',
        albumName: first.name,
        imageUrl: first.images?.[0]?.url || '',
        uri: first.id,
        played_at: first.played_at,
      };
      return;
    }
  }

  console.log('[Recent] Calling getRecentlyPlayedTracks...');
  // 2. Fetch recently played tracks
  try {
    const data = await withRetry(() => getRecentlyPlayedTracks(50));
    const items = (data as any).items ?? [];
    console.log('[Recent] API returned', items.length, 'items');

    // Extract most recently played individual track
    if (items[0]?.track) {
      lastPlayedTrack.value = {
        name: items[0].track.name,
        artistName: items[0].track.artists.map((a: any) => a.name).join(', '),
        albumName: items[0].track.album.name,
        imageUrl: items[0].track.album.images?.[0]?.url || '',
        uri: items[0].track.uri,
        played_at: items[0].played_at,
      };
    }

    // Track container metadata with play count
    interface ContainerMeta {
      container: RecentContainer;
      playCount: number;
    }
    const containerMap = new Map<string, ContainerMeta>();
    const failedPlaylists = new Set<string>();

    function addAlbumFromTrack(track: any, playedAt: string, uri?: string) {
      const album = track.album;
      if (!album?.id) return;
      const existing = containerMap.get(album.id);
      if (existing) {
        existing.playCount++;
        if (playedAt > existing.container.played_at) {
          existing.container.played_at = playedAt;
        }
      } else {
        containerMap.set(album.id, {
          container: {
            id: album.id,
            type: 'album',
            name: album.name || 'Unknown Album',
            images: album.images || [],
            played_at: playedAt,
            artistName: track.artists?.map((a: any) => a.name).join(', ') || '',
            uri: uri || album.uri,
          },
          playCount: 1,
        });
      }
    }

    for (const item of items) {
      const playedAt = item.played_at;
      const track = item.track;
      if (!track) continue;

      const ctx = item.context;
      const ctxType = ctx?.type;
      const ctxUri = ctx?.uri;

      if (ctxType === 'playlist' && ctxUri) {
        // Played from a playlist → show playlist in recent
        const playlistId = ctxUri.split(':')[2];
        if (playlistId) {
          const existing = containerMap.get(playlistId);
          if (existing) {
            existing.playCount++;
            if (playedAt > existing.container.played_at) {
              existing.container.played_at = playedAt;
            }
          } else if (!failedPlaylists.has(playlistId)) {
            const cachedPlaylist = userPlaylists.value.find((p: any) => p.id === playlistId);
            if (cachedPlaylist) {
              containerMap.set(playlistId, {
                container: {
                  id: playlistId,
                  type: 'playlist',
                  name: cachedPlaylist.name,
                  images: cachedPlaylist.images || [],
                  played_at: playedAt,
                  owner: cachedPlaylist.owner?.display_name || '',
                  uri: ctxUri,
                },
                playCount: 1,
              });
            } else {
              try {
                const fetchedPlaylist = await getPlaylist(playlistId);
                if (fetchedPlaylist) {
                  containerMap.set(playlistId, {
                    container: {
                      id: playlistId,
                      type: 'playlist',
                      name: fetchedPlaylist.name,
                      images: fetchedPlaylist.images || [],
                      played_at: playedAt,
                      owner: fetchedPlaylist.owner?.display_name || '',
                      uri: ctxUri,
                    },
                    playCount: 1,
                  });
                }
              } catch (err) {
                failedPlaylists.add(playlistId);
                // Fallback: show album since playlist is inaccessible
                addAlbumFromTrack(track, playedAt, track.album?.uri);
              }
            }
          } else {
            // Already know this playlist is inaccessible → fallback to album
            addAlbumFromTrack(track, playedAt, track.album?.uri);
          }
        }
      } else if (ctxType === 'artist' && ctxUri) {
        // Played from an artist page/radio → show artist + artist radio
        const artistId = ctxUri.split(':')[2];
        const artistName = track.artists?.[0]?.name || 'Unknown Artist';
        const artistImage = track.artists?.[0]?.images?.[0]?.url || track.album?.images?.[0]?.url || '';

        if (artistId) {
          // Artist card
          if (!containerMap.has(artistId)) {
            containerMap.set(artistId, {
              container: {
                id: artistId,
                type: 'artist',
                name: artistName,
                images: artistImage ? [{ url: artistImage }] : [],
                played_at: playedAt,
                uri: ctxUri,
              },
              playCount: 1,
            });
          }
          // Artist radio card (separate entry)
          const radioId = `radio-${artistId}`;
          if (!containerMap.has(radioId)) {
            containerMap.set(radioId, {
              container: {
                id: radioId,
                type: 'radio',
                name: `${artistName} Radio`,
                images: artistImage ? [{ url: artistImage }] : [],
                played_at: playedAt,
                uri: `spotify:radio:artist:${artistId}`,
              },
              playCount: 1,
            });
          }
        }
      } else if (ctxType === 'album' && ctxUri) {
        // Played from an album → show album
        addAlbumFromTrack(track, playedAt, ctxUri);
      } else {
        // No context or collection/unknown → fall back to album
        addAlbumFromTrack(track, playedAt, track.album?.uri);
      }
    }

    // Calculate weighted score and sort
    // RADIO entries get a small boost so they appear alongside their artist
    const result = Array.from(containerMap.values())
      .map(({ container, playCount }) => {
        const hoursAgo = (Date.now() - new Date(container.played_at).getTime()) / (1000 * 60 * 60);
        const recencyWeight = hoursAgo < 24 ? 3 : hoursAgo < 72 ? 2 : hoursAgo < 168 ? 1.5 : 1;
        const typeBonus = container.type === 'radio' ? 1.1 : 1;
        const weightedScore = playCount * recencyWeight * typeBonus;
        return { container: { ...container, playCount }, weightedScore };
      })
      .filter(({ container }) => container.name && container.name.trim() !== '')
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 12)
      .map(({ container }) => container);

    console.log('[Recent] Final containers:', result.length, result.map(c => `${c.type}:${c.name}`));
    recentContainers.value = result;
    if (result.length > 0) {
      const first = result[0];
      lastPlayedTrack.value = {
        name: first.name,
        artistName: first.artistName || '',
        albumName: first.name,
        imageUrl: first.images?.[0]?.url || '',
        uri: first.id,
        played_at: first.played_at,
      };
    }
    setCache(RECENT_CACHE_KEY, result, CACHE_TTL.recentContainers);
  } catch (e) {
    console.warn('[Spotify] Failed to load recent containers:', e);
  }
}

/**
 * Initialize authentication state
 */
export async function initAuth(): Promise<void> {
  isAuthLoading.value = true;
  authError.value = false;

  try {
    // Check mock mode
    const mock = await checkMockMode();
    isMockMode.value = mock;

    // Restore session from storage
    const authenticated = await restoreSession();
    authState.value = authenticated;

    if (!authenticated && !mock) {
      authError.value = true;
    }
  } catch (e) {
    console.warn("Auth initialization failed:", e);
    authError.value = true;
    authState.value = false;
  } finally {
    isAuthLoading.value = false;
  }
}

/**
 * Start playback
 */
export async function playTrack(deviceId?: string): Promise<void> {
  try {
    await withRetry(() => play(deviceId));
    await refreshPlayback();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503")) return; // server error
    console.warn("Failed to play:", msg);
  }
}

/**
 * Pause playback
 */
export async function pauseTrack(): Promise<void> {
  try {
    await withRetry(() => pause());
    await refreshPlayback();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503")) return; // server error
    console.warn("Failed to pause:", msg);
  }
}

/**
 * Clear all signals (for logout)
 */
export function clearStore(): void {
  playbackTrack.value = null;
  playbackVolume.value = 100;
  playbackShuffle.value = false;
  playbackRepeat.value = "off";
  playbackProgress.value = 0;
  playbackDuration.value = 0;
  isPlaying.value = false;
  userProfile.value = null;
  featuredPlaylists.value = [];
  userPlaylists.value = [];
  playbackQueue.value = [];
  queueCurrentTrack.value = null;
  currentArtist.value = null;
  artistTopTracks.value = [];
  artistAlbums.value = [];
  appError.value = null;
  navigationHistory.value = [];
  followedArtists.value = [];
  savedAlbums.value = [];
  homeFeed.value = [];

  if (playbackPollInterval) {
    clearInterval(playbackPollInterval);
    playbackPollInterval = null;
  }
}

export async function loadFollowedArtistsFromCache(): Promise<void> {
  const cached = await getCached<SpotifyArtist[]>('followed_artists');
  if (cached && cached.length > 0) {
    followedArtists.value = cached;
    if (await isCacheFresh('followed_artists')) return;
  }
  await loadFollowedArtists();
  setCache('followed_artists', followedArtists.value, CACHE_TTL.followedArtists);
}

export async function loadSavedAlbumsFromCache(): Promise<void> {
  const cached = await getCached<any[]>('saved_albums');
  if (cached && cached.length > 0) {
    savedAlbums.value = cached;
    if (await isCacheFresh('saved_albums')) return;
  }
  await loadSavedAlbums();
  setCache('saved_albums', savedAlbums.value, CACHE_TTL.savedAlbums);
}
