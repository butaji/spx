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

export function recordPlay(artistName: string, trackName: string) {
  const current = playCounts.value;
  current.artists[artistName] = (current.artists[artistName] || 0) + 1;
  current.tracks[trackName] = (current.tracks[trackName] || 0) + 1;
  playCounts.value = { ...current };
  saveCounts(current);
}

export function getArtistPlayCount(artistName: string): number {
  return playCounts.value.artists[artistName] || 0;
}

export function getTrackPlayCount(trackName: string): number {
  return playCounts.value.tracks[trackName] || 0;
}