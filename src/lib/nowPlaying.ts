/**
 * macOS Now Playing Info Center integration.
 * 
 * Updates the macOS Control Center with SPX's playback state,
 * so users can see track info and control playback from the system UI.
 */

import type { SpotifyTrack } from "../types";
import { tauriInvoke } from "./spotify";

/**
 * Update the Now Playing info with current track details.
 * Called whenever playback state changes.
 */
export async function updateNowPlaying(
  track: SpotifyTrack | null,
  isPlaying: boolean,
  progressMs: number
): Promise<void> {
  console.log("[NowPlaying] updateNowPlaying called:", track?.name, isPlaying);
  try {
    if (!track) {
      // No track playing, clear Now Playing
      await tauriInvoke("clear_now_playing");
      return;
    }

    await tauriInvoke("update_now_playing", {
      title: track.name,
      artist: track.artists?.map((a) => a.name).join(", ") ?? null,
      album: track.album?.name ?? null,
      durationMs: track.duration_ms ?? null,
      elapsedMs: progressMs,
      isPlaying,
    });
  } catch (e) {
    console.error("[NowPlaying] Failed to update:", e);
  }
}

/**
 * Clear the Now Playing info (called when playback stops).
 */
export async function clearNowPlaying(): Promise<void> {
  try {
    await tauriInvoke("clear_now_playing");
  } catch (e) {
    console.error("[NowPlaying] Failed to clear:", e);
  }
}
