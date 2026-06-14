import { signal } from "@preact/signals";
import {
  getUserProfile,
  getTopArtists,
  getTopTracks,
  getFollowedArtists,
  getSavedAlbums,
} from "../lib/spotify";
import { withRetry } from "../lib/retry";
import { getCached, setCache, isCacheFresh } from "../lib/cache";
import type { SpotifyArtist, SpotifyTrack, SpotifyAlbum } from "../types";

export const userProfile = signal<{ name: string; image?: string } | null>(null);
export const topArtists = signal<SpotifyArtist[]>([]);
export const topTracks = signal<SpotifyTrack[]>([]);
export const followedArtists = signal<SpotifyArtist[]>([]);
export const savedAlbums = signal<SpotifyAlbum[]>([]);

const CACHE_TTL = {
  profile: 10 * 60 * 1000,
  followedArtists: 10 * 60 * 1000,
  savedAlbums: 10 * 60 * 1000,
};

export async function loadUserProfile(): Promise<void> {
  const cached = await getCached("user_profile");
  if (cached) {
    userProfile.value = cached;
    if (await isCacheFresh("user_profile")) return;
  }

  try {
    const data = await withRetry(() => getUserProfile());
    const profile = { name: data.display_name, image: data.images?.[0]?.url };
    userProfile.value = profile;
    setCache("user_profile", profile, CACHE_TTL.profile);
  } catch (e) {
    console.warn("[Spotify] Failed to load profile:", e);
  }
}

export async function loadTopArtists(): Promise<void> {
  try {
    const artists = await getTopArtists(10, "medium_term");
    topArtists.value = artists;
  } catch (err) {
    console.warn("[Store] Failed to load top artists:", err);
  }
}

export async function loadTopTracks(): Promise<void> {
  try {
    const tracks = await getTopTracks(20, "short_term");
    topTracks.value = tracks;
  } catch (err) {
    console.warn("[Store] Failed to load top tracks:", err);
  }
}

export async function loadFollowedArtists(): Promise<void> {
  try {
    const artists = await getFollowedArtists();
    followedArtists.value = artists;
  } catch (err) {
    console.warn("[Store] Failed to load followed artists:", err);
  }
}

export async function loadSavedAlbums(): Promise<void> {
  try {
    const data = await getSavedAlbums();
    const albums =
      (data as { items?: Array<{ album?: SpotifyAlbum | null }> }).items
        ?.map((item) => item.album)
        .filter((album): album is SpotifyAlbum => Boolean(album)) ?? [];
    savedAlbums.value = albums;
  } catch (err) {
    console.warn("[Store] Failed to load saved albums:", err);
  }
}

export async function loadFollowedArtistsFromCache(): Promise<void> {
  const cached = await getCached("followed_artists");
  if (cached && cached.length > 0) {
    followedArtists.value = cached;
    if (await isCacheFresh("followed_artists")) return;
  }
  await loadFollowedArtists();
  setCache("followed_artists", followedArtists.value, CACHE_TTL.followedArtists);
}

export async function loadSavedAlbumsFromCache(): Promise<void> {
  const cached = await getCached("saved_albums");
  if (cached && cached.length > 0) {
    savedAlbums.value = cached;
    if (await isCacheFresh("saved_albums")) return;
  }
  await loadSavedAlbums();
  setCache("saved_albums", savedAlbums.value, CACHE_TTL.savedAlbums);
}
