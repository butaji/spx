import { signal } from "@preact/signals";
import { getPlaybackState, checkSavedTracks } from "../lib/spotify";
import { controllerPlay, controllerPause } from "../lib/playerController";
import { withRetry } from "../lib/retry";
import type { SpotifyTrack } from "../types";

export const playbackTrack = signal<SpotifyTrack | null>(null);
export const playbackVolume = signal<number>(100);
export const playbackShuffle = signal<boolean>(false);
export const playbackRepeat = signal<"off" | "context" | "track">("off");
export const playbackProgress = signal<number>(0);
export const playbackDuration = signal<number>(0);
export const isPlaying = signal<boolean>(false);
export const likedTrack = signal<boolean>(false);

let playbackPollInterval: ReturnType<typeof setInterval> | null = null;

export async function refreshPlayback(): Promise<void> {
  try {
    const state = await withRetry(() => getPlaybackState());
    if (!state) return;

    const item = state.item as SpotifyTrack | undefined;
    if (item) {
      playbackTrack.value = item;
      playbackDuration.value = item.duration_ms ?? 0;
    }

    playbackProgress.value = state.progress_ms ?? 0;
    isPlaying.value = state.is_playing ?? false;
    playbackShuffle.value = state.shuffle_state ?? false;
    playbackRepeat.value = (state.repeat_state as "off" | "context" | "track") ?? "off";
    playbackVolume.value = state.device?.volume_percent ?? 100;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503") || msg.includes("Bad gateway")) {
      return;
    }
    if (msg.includes("Not authenticated") || msg.includes("401")) {
      return;
    }
    console.warn("Playback refresh issue:", msg);
  }
}

export function stopPlaybackPolling(): void {
  if (playbackPollInterval) {
    clearInterval(playbackPollInterval);
    playbackPollInterval = null;
  }
}

export function startPlaybackPolling(): () => void {
  if (playbackPollInterval) {
    clearInterval(playbackPollInterval);
  }

  refreshPlayback();
  playbackPollInterval = setInterval(() => {
    refreshPlayback().catch(() => {});
  }, 1000);

  return () => {
    stopPlaybackPolling();
  };
}

export async function playTrack(deviceId?: string): Promise<void> {
  try {
    await controllerPlay(deviceId);
    await refreshPlayback();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503")) return;
    console.warn("Failed to play:", msg);
  }
}

export async function pauseTrack(): Promise<void> {
  try {
    await controllerPause();
    await refreshPlayback();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503")) return;
    console.warn("Failed to pause:", msg);
  }
}

export async function refreshLikedStatus(trackId?: string): Promise<void> {
  if (!trackId) {
    likedTrack.value = false;
    return;
  }
  try {
    const result = await checkSavedTracks([trackId]);
    likedTrack.value = result[0] ?? false;
  } catch (err) {
    console.warn("[Store] Failed to check liked status:", err);
    likedTrack.value = false;
  }
}
