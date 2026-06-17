/**
 * usePlayback - Main playback hook
 * 
 * Composes smaller focused hooks for playback functionality:
 * - usePlaybackControls: play/pause, next/prev, seek, shuffle, repeat, mute
 * - usePlayCount: play count tracking
 * - useLikedTrack: liked track state
 */

import { useState, useCallback, useEffect, useRef } from "preact/compat";
import { debug } from "../lib/utils";
import { playContext, playUris } from "../lib/spotify";
import { controllerSetVolume } from "../lib/playerController";
import {
  playbackTrack,
  playbackVolume,
  isPlaying,
  refreshPlayback,
  playTrack,
  pauseTrack,
  startPlaybackPolling,
} from "../stores/spotify";
import { handleError, showError } from "../lib/errors";
import { setPlaybackUserActionCooldown } from "../stores/playback";
import { usePlaybackControls } from "./usePlaybackControls";
import { usePlayCount } from "./usePlayCount";
import { useLikedTrack } from "./useLikedTrack";

interface UsePlaybackOptions {
  ensureActiveDevice: () => Promise<string | null>;
}

export function usePlayback({ ensureActiveDevice }: UsePlaybackOptions) {
  const [isPlayActionLoading, setIsPlayActionLoading] = useState(false);
  const isPlayActionLoadingRef = useRef(isPlayActionLoading);
  isPlayActionLoadingRef.current = isPlayActionLoading;

  // Start playback polling
  useEffect(() => {
    const cleanup = startPlaybackPolling();
    return cleanup;
  }, []);

  // Compose smaller hooks
  const controls = usePlaybackControls({ ensureActiveDevice });
  usePlayCount();
  const liked = useLikedTrack();

  const handlePlayPause = useCallback(async () => {
    debug('[Play/Pause] Button clicked');

    if (isPlayActionLoadingRef.current) {
      debug('[Play/Pause] Already loading, ignoring');
      return;
    }

    setIsPlayActionLoading(true);
    debug('[Play/Pause] Loading state set to true');

    const track = playbackTrack.value;
    const playing = isPlaying.value;
    debug('[Play/Pause] Current track:', track?.name, 'isPlaying signal:', playing);

    // OPTIMISTIC UPDATE
    if (track) {
      isPlaying.value = !playing;
      debug('[Play/Pause] Optimistic update: isPlaying =', !playing);
    }

    try {
      // Prevent stale API responses from flipping the button back immediately.
      setPlaybackUserActionCooldown();
      if (playing) {
        debug('[Play/Pause] Calling pauseTrack()...');
        await pauseTrack();
        debug('[Play/Pause] pauseTrack() succeeded');
      } else {
        debug('[Play/Pause] Need to play, checking devices...');

        const deviceId = await ensureActiveDevice();
        debug('[Play/Pause] ensureActiveDevice returned:', deviceId);

        if (!deviceId) {
          console.warn('[Play/Pause] Cannot play - no device available');
          isPlaying.value = playing;
          showError(
            "No Playback Device",
            "SPX couldn't find a device to play on. SPX can always play through its built-in SPX Player on this Mac.",
            {
              solution: [
                "Wait a moment for the SPX Player to connect",
                "Check that macOS Local Network permission is allowed for SPX",
                "Select a speaker from the device menu"
              ],
              action: {
                label: "Scan network",
                onClick: () => {
                  import("../stores/devices").then(({ refreshLocalDevices }) =>
                    refreshLocalDevices(true).catch(console.error)
                  );
                }
              }
            }
          );
          return;
        }

        debug('[Play/Pause] Calling playTrack()...');
        await playTrack();
        debug('[Play/Pause] playTrack() succeeded');
      }

      setTimeout(() => {
        debug('[Play/Pause] Refreshing playback state...');
        refreshPlayback();
      }, 2000);
    } catch (error) {
      console.error('[Play/Pause] ERROR:', error);
      // Revert optimistic update on any error.
      isPlaying.value = playing;
      handleError(error, "Play/Pause");
    } finally {
      debug('[Play/Pause] Setting loading to false');
      setIsPlayActionLoading(false);
    }
  }, [ensureActiveDevice]);

  const playContextFn = useCallback(async (uri: string, offsetUri?: string) => {
    try {
      const deviceId = await ensureActiveDevice();
      if (!deviceId) {
        showError(
          "No Active Device",
          "SPX can play through the built-in SPX Player on this Mac.",
          {
            solution: [
              "Wait for the SPX Player to connect",
              "Select a speaker from the device menu",
              "Check that macOS Local Network permission is allowed for SPX"
            ]
          }
        );
        return;
      }
      await playContext(uri, offsetUri, deviceId);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to play context:", e);
      handleError(e, "Play Context");
    }
  }, [ensureActiveDevice]);

  const playUrisFn = useCallback(async (uris: string[], offset?: number) => {
    try {
      const deviceId = await ensureActiveDevice();
      if (!deviceId) {
        showError(
          "No Active Device",
          "SPX can play through the built-in SPX Player on this Mac.",
          {
            solution: [
              "Wait for the SPX Player to connect",
              "Select a speaker from the device menu",
              "Check that macOS Local Network permission is allowed for SPX"
            ]
          }
        );
        return;
      }
      await playUris(uris, offset, deviceId);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to play URIs:", e);
      handleError(e, "Play Tracks");
    }
  }, [ensureActiveDevice]);

  const adjustVolume = useCallback(async (delta: number) => {
    const v = Math.max(0, Math.min(100, playbackVolume.value + delta));
    try {
      await controllerSetVolume(v);
      playbackVolume.value = v;
    } catch (ev) {
      console.error("Failed to adjust volume:", ev);
    }
  }, []);

  const handleVolumeChange = useCallback(async (vol: number) => {
    try {
      await controllerSetVolume(vol);
      playbackVolume.value = vol;
    } catch (e) {
      console.error("Failed to set volume:", e);
    }
  }, []);

  return {
    isPlayActionLoading,
    handlePlayPause,
    ...controls,
    playContextFn,
    playUrisFn,
    adjustVolume,
    handleToggleLike: liked.toggleLike,
    handleVolumeChange,
  };
}
