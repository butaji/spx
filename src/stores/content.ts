import { signal } from "@preact/signals";
import {
  getUserPlaylists,
  getQueue,
  getArtist,
  getArtistTopTracks,
  getArtistAlbums,
  getRecentlyPlayedTracks,
  getPlaylist,
  getBrowseCategories,
  getCategoryPlaylists,
  getNewReleases,
  getTopTracks,
  getTopArtists,
} from "../lib/spotify";
import { withRetry } from "../lib/retry";
import { getCached, setCache, isCacheFresh } from "../lib/cache";
import type { SpotifyArtist, SpotifyTrack, SpotifyAlbum, SpotifyPlaylist, SpotifyImage } from "../types";

export interface RecentContainer {
  id: string;
  type: "album" | "playlist" | "artist" | "radio";
  name: string;
  images: { url: string }[];
  played_at: string;
  owner?: string;
  artistName?: string;
  artistId?: string;
  playCount?: number;
  uri?: string;
}

export interface HomeFeedItem {
  id: string;
  name: string;
  image: string;
  type: "artist" | "album" | "playlist" | "radio";
  uri?: string;
  subtitle?: string;
}

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

export const userPlaylists = signal<SpotifyPlaylist[]>([]);
export const playbackQueue = signal<SpotifyTrack[]>([]);
export const queueCurrentTrack = signal<SpotifyTrack | null>(null);
export const currentArtist = signal<SpotifyArtist | null>(null);
export const artistTopTracks = signal<SpotifyTrack[]>([]);
export const artistAlbums = signal<SpotifyAlbum[]>([]);
export const recentContainers = signal<RecentContainer[]>([]);
export const categoryPlaylists = signal<
  Array<{ id: string; name: string; image: string; uri: string }>
>([]);
export const newReleases = signal<Array<{ id: string; name: string; artists: string; image: string; uri: string }>>([]);
export const homeFeed = signal<HomeFeedItem[]>([]);
export const lastPlayedTrack = signal<LastPlayedTrack | null>(null);
export const contextPanelItem = signal<{
  type: "artist" | "album" | "playlist" | "track";
  id: string;
} | null>(null);
export const navigationHistory = signal<unknown[]>([]);

const CACHE_TTL = {
  playlists: 5 * 60 * 1000,
  queue: 30 * 1000,
  recentContainers: 2 * 60 * 1000,
};
const RECENT_CACHE_KEY = "recent_containers_v4";

export async function loadUserPlaylists(): Promise<void> {
  const cached = await getCached<SpotifyPlaylist[]>("user_playlists");
  if (cached && cached.length > 0) {
    userPlaylists.value = cached;
    if (await isCacheFresh("user_playlists")) return;
  }

  try {
    const playlists = await withRetry(() => getUserPlaylists());
    const items = (playlists as { items?: SpotifyPlaylist[] }).items ?? [];
    userPlaylists.value = items;
    setCache("user_playlists", items, CACHE_TTL.playlists);
  } catch (e) {
    console.warn("[Spotify] Failed to load playlists:", e);
  }
}

export async function loadQueue(): Promise<void> {
  try {
    const queue = await getQueue();
    playbackQueue.value = (queue.queue ?? []) as SpotifyTrack[];
  } catch (e) {
    console.warn("Failed to load queue:", e);
  }
}

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
  }
}

export async function loadRecentContainers(): Promise<void> {
  const cached = await getCached<RecentContainer[]>(RECENT_CACHE_KEY);
  if (cached && cached.length > 0) {
    recentContainers.value = cached;
    if (await isCacheFresh(RECENT_CACHE_KEY)) {
      const data = await getRecentlyPlayedTracks(1);
      const items = (data as { items?: Array<{ track?: SpotifyTrack }> }).items ?? [];
      if (items[0]?.track) {
        const track = items[0].track;
        lastPlayedTrack.value = {
          name: track.name,
          artistName: track.artists?.map((a) => a.name).join(", ") || "",
          artistId: track.artists?.[0]?.id,
          albumName: track.album?.name || "",
          imageUrl: track.album?.images?.[0]?.url || "",
          uri: track.uri,
          played_at: (items[0] as unknown as { played_at: string }).played_at,
        };
      }
      return;
    }
  }

  try {
    const data = await withRetry(() => getRecentlyPlayedTracks(50));
    const items = (data as { items?: any[] }).items ?? [];

    if (items[0]?.track) {
      const track = items[0].track;
      lastPlayedTrack.value = {
        name: track.name,
        artistName: track.artists?.[0]?.name || "",
        artistId: track.artists?.[0]?.id,
        albumName: track.album?.name || "",
        imageUrl: track.album?.images?.[0]?.url || "",
        uri: track.uri,
        played_at: items[0].played_at,
      };
    }

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
            type: "album",
            name: album.name || "Unknown Album",
            images: album.images || [],
            played_at: playedAt,
            artistName: track.artists?.map((a: any) => a.name).join(", ") || "",
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

      if (ctxType === "playlist" && ctxUri) {
        const playlistId = ctxUri.split(":")[2];
        if (playlistId) {
          const existing = containerMap.get(playlistId);
          if (existing) {
            existing.playCount++;
            if (playedAt > existing.container.played_at) {
              existing.container.played_at = playedAt;
            }
          } else if (!failedPlaylists.has(playlistId)) {
            const cachedPlaylist = userPlaylists.value.find((p) => p.id === playlistId);
            if (cachedPlaylist) {
              containerMap.set(playlistId, {
                container: {
                  id: playlistId,
                  type: "playlist",
                  name: cachedPlaylist.name,
                  images: cachedPlaylist.images || [],
                  played_at: playedAt,
                  owner: cachedPlaylist.owner?.display_name || "",
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
                      type: "playlist",
                      name: fetchedPlaylist.name,
                      images: fetchedPlaylist.images || [],
                      played_at: playedAt,
                      owner: fetchedPlaylist.owner?.display_name || "",
                      uri: ctxUri,
                    },
                    playCount: 1,
                  });
                }
              } catch {
                failedPlaylists.add(playlistId);
                containerMap.set(playlistId, {
                  container: {
                    id: playlistId,
                    type: "playlist",
                    name: track.album?.name || "Spotify Mix",
                    images: track.album?.images || [],
                    played_at: playedAt,
                    owner: track.artists?.map((a: any) => a.name).join(", ") || "",
                    uri: ctxUri,
                  },
                  playCount: 1,
                });
              }
            }
          } else {
            const existing = containerMap.get(playlistId);
            if (existing) {
              existing.playCount++;
              if (playedAt > existing.container.played_at) {
                existing.container.played_at = playedAt;
              }
            }
          }
        }
      } else if (ctxType === "artist" && ctxUri) {
        const artistId = ctxUri.split(":")[2];
        const artistName = track.artists?.[0]?.name || "";
        const artistImage =
          track.artists?.[0]?.images?.[0]?.url || track.album?.images?.[0]?.url || "";

        if (artistId) {
          if (!containerMap.has(artistId)) {
            containerMap.set(artistId, {
              container: {
                id: artistId,
                type: "artist",
                name: artistName,
                images: artistImage ? [{ url: artistImage }] : [],
                played_at: playedAt,
                uri: ctxUri,
              },
              playCount: 1,
            });
          }
          const radioId = `radio-${artistId}`;
          if (!containerMap.has(radioId)) {
            containerMap.set(radioId, {
              container: {
                id: radioId,
                type: "radio",
                name: `${artistName} Radio`,
                images: artistImage ? [{ url: artistImage }] : [],
                played_at: playedAt,
                uri: `spotify:radio:artist:${artistId}`,
              },
              playCount: 1,
            });
          }
        }
      } else if (ctxType === "album" && ctxUri) {
        addAlbumFromTrack(track, playedAt, ctxUri);
      } else {
        addAlbumFromTrack(track, playedAt, track.album?.uri);
      }
    }

    const result = Array.from(containerMap.values())
      .map(({ container, playCount }) => {
        const hoursAgo =
          (Date.now() - new Date(container.played_at).getTime()) / (1000 * 60 * 60);
        const recencyWeight =
          hoursAgo < 24 ? 3 : hoursAgo < 72 ? 2 : hoursAgo < 168 ? 1.5 : 1;
        const typeBonus = container.type === "radio" ? 1.1 : 1;
        const weightedScore = playCount * recencyWeight * typeBonus;
        return { container: { ...container, playCount }, weightedScore };
      })
      .filter(({ container }) => container.name && container.name.trim() !== "")
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 12)
      .map(({ container }) => container);

    recentContainers.value = result;
    if (result.length > 0 && items[0]?.track) {
      const track = items[0].track;
      lastPlayedTrack.value = {
        name: track.name,
        artistName: track.artists?.[0]?.name || "",
        artistId: track.artists?.[0]?.id,
        albumName: track.album?.name || "",
        imageUrl: track.album?.images?.[0]?.url || "",
        uri: track.uri,
        played_at: items[0].played_at,
      };
    }
    setCache(RECENT_CACHE_KEY, result, CACHE_TTL.recentContainers);
  } catch (e) {
    console.warn("[Spotify] Failed to load recent containers:", e);
  }
}

export async function buildHomeFeed(): Promise<void> {
  const items: HomeFeedItem[] = [];

  try {
    const tracks = await withRetry(() => getTopTracks(50, "short_term"));
    const albumMap = new Map<
      string,
      { name: string; image: string; uri: string; artist: string; count: number }
    >();

    for (const track of tracks) {
      const a = track.album;
      if (!a?.id) continue;
      const entry = albumMap.get(a.id);
      if (entry) {
        entry.count++;
      } else {
        albumMap.set(a.id, {
          name: a.name || "Unknown",
          image: a.images?.[0]?.url || "",
          uri: a.uri || `spotify:album:${a.id}`,
          artist: track.artists?.map((x: any) => x.name).join(", ") || "",
          count: 1,
        });
      }
    }

    const albums = Array.from(albumMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([id, a]) => ({
        id,
        name: a.name,
        image: a.image,
        type: "album" as const,
        uri: a.uri,
        subtitle: a.artist,
      }));
    items.push(...albums);
  } catch (e) {
    console.warn("[HomeFeed] top/tracks failed:", e);
  }

  try {
    const artists = await getTopArtists(3, "short_term");
    const radios = artists.map((a: SpotifyArtist) => ({
      id: `radio-${a.id}`,
      name: `${a.name} Radio`,
      image: a.images?.[0]?.url || "",
      type: "radio" as const,
      uri: `spotify:artist:${a.id}`,
      subtitle: "Radio",
    }));
    items.push(...radios);
  } catch (e) {
    console.warn("[HomeFeed] top artists failed:", e);
  }

  try {
    const existingIds = new Set(items.map((i) => i.id));
    const recent = await withRetry(() => getRecentlyPlayedTracks(50));
    const rItems = (recent as { items?: any[] }).items ?? [];
    const playlistMap = new Map<string, { count: number }>();

    for (const item of rItems) {
      const ctx = item.context;
      if (ctx?.type !== "playlist" || !ctx.uri) continue;
      const pid = ctx.uri.split(":")[2];
      if (!pid || existingIds.has(pid)) continue;
      const entry = playlistMap.get(pid);
      if (entry) {
        entry.count++;
      } else {
        playlistMap.set(pid, { count: 1 });
      }
    }

    const playlistIds = Array.from(playlistMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, Math.max(0, 12 - items.length))
      .map(([id]) => id);

    for (const pid of playlistIds) {
      const cached = userPlaylists.value.find((p) => p.id === pid);
      if (cached) {
        items.push({
          id: pid,
          name: cached.name,
          image: cached.images?.[0]?.url || "",
          type: "playlist" as const,
          uri: `spotify:playlist:${pid}`,
          subtitle: cached.owner?.display_name || "Playlist",
        });
        continue;
      }
      try {
        const pl = await getPlaylist(pid);
        items.push({
          id: pid,
          name: pl.name || "Playlist",
          image: (pl as unknown as { images?: SpotifyImage[] }).images?.[0]?.url || "",
          type: "playlist" as const,
          uri: `spotify:playlist:${pid}`,
          subtitle: (pl as unknown as { owner?: { display_name?: string } }).owner?.display_name || "Playlist",
        });
      } catch {
        // Skip unresolvable playlists
      }
    }
  } catch (e) {
    console.warn("[HomeFeed] recently-played playlists failed:", e);
  }

  homeFeed.value = items;
}

export async function loadRecentActivity(): Promise<void> {
  await loadRecentContainers();
  await loadUserPlaylists();
  await buildHomeFeed();
}

export async function loadCategoryPlaylists(): Promise<void> {
  try {
    const categories = await getBrowseCategories(10);
    const allPlaylists: typeof categoryPlaylists.value = [];
    for (const category of categories.slice(0, 3)) {
      try {
        const playlists = await getCategoryPlaylists(category.id, 5);
        allPlaylists.push(...playlists.slice(0, 2));
      } catch (err) {
        console.warn("[Store] Failed to load category playlists:", category.id);
      }
    }
    categoryPlaylists.value = allPlaylists;
  } catch (err) {
    console.warn("[Store] Failed to load browse categories:", err);
  }
}

export async function loadNewReleases(): Promise<void> {
  try {
    const releases = await getNewReleases(10);
    newReleases.value = releases;
  } catch (err) {
    console.warn("[Store] Failed to load new releases:", err);
  }
}
