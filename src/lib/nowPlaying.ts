/**
 * macOS Now Playing Info Center integration.
 * 
 * Updates the macOS Control Center with SPX's playback state,
 * so users can see track info and control playback from the system UI.
 */

import { invoke } from "@tauri-apps/api/core";
import type { SpotifyTrack } from "../types";

/**
 * Update the Now Playing info with current track details.
 * Called whenever playback state changes.
 */
export async function updateNowPlaying(
  track: SpotifyTrack | null,
  isPlaying: boolean,
  progressMs: number
): Promise<void> {
  try {
    if (!track) {
      // No track playing, clear Now Playing
      await invoke("clear_now_playing");
      return;
    }

    await invoke("update_now_playing", {
      title: track.name,
      artist: track.artists?.map((a) => a.name).join(", ") ?? null,
      album: track.album?.name ?? null,
      durationMs: track.duration_ms ?? null,
      elapsedMs: progressMs,
      isPlaying,
    });
  } catch (e) {
    // Silently fail - Now Playing is a nice-to-have feature
    console.debug("Failed to update Now Playing:", e);
  }
}

/**
 * Clear the Now Playing info (called when playback stops).
 */
export async function clearNowPlaying(): Promise<void> {
  try {
    await invoke("clear_now_playing");
  } catch (e) {
    console.debug("Failed to clear Now Playing:", e);
  }
}
