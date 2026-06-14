import { signal } from "@preact/signals";
import { getPlaybackState, checkSavedTracks } from "../lib/spotify";
import { controllerPlay, controllerPause } from "../lib/playerController";
import { withRetry } from "../lib/retry";
import { updateNowPlaying } from "../lib/nowPlaying";
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

// ─── Buffered Playback State (per spotify-player pattern) ─────────────────────

// Local buffer for optimistic updates and smooth progress
interface PlaybackBuffer {
  isPlaying: boolean;
  progress: number;
  duration: number;
  lastUpdateTime: number; // Date.now() when progress was last set
  trackId: string | null;
}

let playbackBuffer: PlaybackBuffer = {
  isPlaying: false,
  progress: 0,
  duration: 0,
  lastUpdateTime: 0,
  trackId: null,
};

// RAF-based progress updater for smooth UI without API calls
let rafId: number | null = null;

function updateProgressFromBuffer() {
  if (playbackBuffer.isPlaying && playbackBuffer.duration > 0) {
    const now = Date.now();
    const elapsed = now - playbackBuffer.lastUpdateTime;
    playbackBuffer.progress = Math.min(
      playbackBuffer.progress + elapsed,
      playbackBuffer.duration
    );
    playbackBuffer.lastUpdateTime = now;
    playbackProgress.value = playbackBuffer.progress;
  }
  rafId = requestAnimationFrame(updateProgressFromBuffer);
}

function startProgressRAF() {
  if (rafId === null) {
    playbackBuffer.lastUpdateTime = Date.now();
    rafId = requestAnimationFrame(updateProgressFromBuffer);
  }
}

function stopProgressRAF() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Update the playback buffer with new state from API
 */
function updateBufferFromState(state: any, track: SpotifyTrack | undefined) {
  const newTrackId = track?.id ?? null;
  
  // If track changed, reset buffer
  if (playbackBuffer.trackId !== newTrackId) {
    playbackBuffer.trackId = newTrackId;
    playbackBuffer.progress = state.progress_ms ?? 0;
    playbackBuffer.duration = track?.duration_ms ?? 0;
  }
  
  playbackBuffer.isPlaying = state.is_playing ?? false;
  playbackBuffer.lastUpdateTime = Date.now();
  
  // Update signals
  playbackProgress.value = playbackBuffer.progress;
  
  // Start/stop RAF based on playing state
  if (playbackBuffer.isPlaying) {
    startProgressRAF();
  } else {
    stopProgressRAF();
  }
}

/**
 * Optimistic update: set isPlaying immediately without waiting for API
 */
export function setIsPlayingOptimistic(playing: boolean) {
  playbackBuffer.isPlaying = playing;
  playbackBuffer.lastUpdateTime = Date.now();
  isPlaying.value = playing;
  
  if (playing) {
    startProgressRAF();
  } else {
    stopProgressRAF();
  }
}

/**
 * Optimistic update: seek to position immediately
 */
export function setProgressOptimistic(positionMs: number) {
  playbackBuffer.progress = positionMs;
  playbackBuffer.lastUpdateTime = Date.now();
  playbackProgress.value = positionMs;
}

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
    
    // Update buffer for smooth progress tracking
    updateBufferFromState(state, item);
    
    // Update macOS Now Playing
    updateNowPlaying(item ?? null, state.is_playing ?? false, state.progress_ms ?? 0);
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
    // Already polling; return existing stop handler.
    return () => stopPlaybackPolling();
  }

  refreshPlayback().catch(() => {});
  playbackPollInterval = setInterval(() => {
    refreshPlayback().catch(() => {});
  }, 5000);

  return () => {
    stopPlaybackPolling();
  };
}

export async function playTrack(): Promise<void> {
  // Optimistic update for immediate UI feedback
  setIsPlayingOptimistic(true);
  
  // Update Now Playing immediately
  updateNowPlaying(playbackTrack.value, true, playbackProgress.value);
  
  try {
    await controllerPlay();
    // Don't wait for refreshPlayback - RAF will handle progress smoothly
    // refreshPlayback(); // Optional: uncomment if you want strict API sync
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503")) return;
    // Revert optimistic update on error
    setIsPlayingOptimistic(false);
    // Revert Now Playing
    updateNowPlaying(playbackTrack.value, false, playbackProgress.value);
    console.warn("Failed to play:", msg);
  }
}

export async function pauseTrack(): Promise<void> {
  // Optimistic update for immediate UI feedback
  setIsPlayingOptimistic(false);
  
  // Update Now Playing immediately
  updateNowPlaying(playbackTrack.value, false, playbackProgress.value);
  
  try {
    await controllerPause();
    // Don't wait for refreshPlayback - RAF handles progress
    // refreshPlayback(); // Optional: uncomment if you want strict API sync
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("502") || msg.includes("503")) return;
    // Revert optimistic update on error
    setIsPlayingOptimistic(true);
    // Revert Now Playing
    updateNowPlaying(playbackTrack.value, true, playbackProgress.value);
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
