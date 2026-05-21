import { signal } from "@preact/signals";
import { getRecentlyPlayedTracks } from "../lib/spotify";
import { getCached, setCache, isCacheFresh } from "../lib/cache";

const RECENT_COUNTS_KEY = "spotify_recent_counts";
const RECENT_TTL = 5 * 60 * 1000; // 5 minutes

interface SpotifyPlayCounts {
  artists: Record<string, number>;
  tracks: Record<string, number>;
  fetchedAt: number;
}

export const spotifyPlayCounts = signal<SpotifyPlayCounts>({
  artists: {},
  tracks: {},
  fetchedAt: 0,
});

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

async function fetchAndCountFromAPI(): Promise<SpotifyPlayCounts> {
  const data = await getRecentlyPlayedTracks(50);
  const artists: Record<string, number> = {};
  const tracks: Record<string, number> = {};

  for (const item of data.items ?? []) {
    const track = item.track;
    if (!track) continue;

    // Count artist
    for (const artist of track.artists ?? []) {
      const key = normalizeKey(artist.name);
      artists[key] = (artists[key] ?? 0) + 1;
    }

    // Count track
    const trackKey = normalizeKey(track.name);
    tracks[trackKey] = (tracks[trackKey] ?? 0) + 1;
  }

  return {
    artists,
    tracks,
    fetchedAt: Date.now(),
  };
}

async function loadCachedCounts(): Promise<SpotifyPlayCounts | null> {
  try {
    const cached = await getCached<SpotifyPlayCounts>(RECENT_COUNTS_KEY);
    return cached ?? null;
  } catch {
    return null;
  }
}

export async function syncWithSpotifyCounts(): Promise<void> {
  // Stale-while-revalidate: use cache if fresh, fetch in background
  const cached = await loadCachedCounts();
  const isFresh = cached ? await isCacheFresh(RECENT_COUNTS_KEY) : false;

  if (cached && isFresh) {
    spotifyPlayCounts.value = cached;
    return;
  }

  // Use stale data while revalidating
  if (cached) {
    spotifyPlayCounts.value = cached;
  }

  // Fetch fresh data in background
  try {
    const fresh = await fetchAndCountFromAPI();
    spotifyPlayCounts.value = fresh;
    setCache(RECENT_COUNTS_KEY, fresh, RECENT_TTL);
  } catch (e) {
    console.warn("[SpotifyPlayCounts] Failed to fetch from API:", e);
  }
}

export async function forceRefreshCounts(): Promise<void> {
  try {
    const fresh = await fetchAndCountFromAPI();
    spotifyPlayCounts.value = fresh;
    setCache(RECENT_COUNTS_KEY, fresh, RECENT_TTL);
  } catch (e) {
    console.warn("[SpotifyPlayCounts] Failed to force refresh:", e);
  }
}

export function getSpotifyArtistCount(name: string): number {
  return spotifyPlayCounts.value.artists[normalizeKey(name)] ?? 0;
}

export function getSpotifyTrackCount(name: string): number {
  return spotifyPlayCounts.value.tracks[normalizeKey(name)] ?? 0;
}

export function hasSpotifyCounts(): boolean {
  return spotifyPlayCounts.value.fetchedAt > 0;
}
