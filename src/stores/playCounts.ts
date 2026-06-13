import { signal } from "@preact/signals";

interface PlayCounts {
  artists: Record<string, number>;
  tracks: Record<string, number>;
}

const STORAGE_KEY = "spx_play_counts";

function loadCounts(): PlayCounts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { artists: {}, tracks: {} };
}

function saveCounts(counts: PlayCounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

export const playCounts = signal<PlayCounts>(loadCounts());

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

export function recordPlay(artistName: string, trackName: string) {
  const normalizedArtist = normalizeKey(artistName);
  const normalizedTrack = normalizeKey(trackName);
  const current = playCounts.value;
  current.artists[normalizedArtist] = (current.artists[normalizedArtist] || 0) + 1;
  current.tracks[normalizedTrack] = (current.tracks[normalizedTrack] || 0) + 1;
  playCounts.value = { ...current };
  saveCounts(current);
}

export function getArtistPlayCount(artistName: string): number {
  return playCounts.value.artists[normalizeKey(artistName)] || 0;
}

export function getTrackPlayCount(trackName: string): number {
  return playCounts.value.tracks[normalizeKey(trackName)] || 0;
}