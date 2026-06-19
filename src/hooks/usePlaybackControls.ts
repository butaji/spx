/**
 * usePlaybackControls - Focused hook for playback control actions
 * 
 * Handles: play, pause, next, previous, seek, shuffle, repeat, mute toggle
 */

import { useCallback, useRef } from "preact/hooks";
import { setShuffle as apiSetShuffle, setRepeat as apiSetRepeat } from "../lib/spotify";
import {
  controllerNext,
  controllerPrevious,
  controllerSeek,
  controllerSetVolume,
} from "../lib/playerController";
import {
  playbackShuffle,
  playbackRepeat,
  playbackVolume,
  refreshPlayback,
} from "../stores/spotify";
import { handleError, showError } from "../lib/errors";

interface UsePlaybackControlsOptions {
  ensureActiveDevice: () => Promise<string | null>;
}

export function usePlaybackControls({ ensureActiveDevice }: UsePlaybackControlsOptions) {
  const prevVolumeRef = useRef<number | null>(null);
  const handleNext = useCallback(async () => {
    try {
      const hasDevice = await ensureActiveDevice();
      if (!hasDevice) {
        showError("No Active Device", "SPX can play through the built-in SPX Player on this Mac.", {
          solution: ["Wait for the SPX Player to connect", "Select a speaker from the device menu"]
        });
        return;
      }
      await controllerNext();
      refreshPlayback();
    } catch (e) {
      console.error("Failed to skip next:", e);
      handleError(e, "Skip Next");
    }
  }, [ensureActiveDevice]);

  const handlePrev = useCallback(async () => {
    try {
      const hasDevice = await ensureActiveDevice();
      if (!hasDevice) {
        showError("No Active Device", "SPX can play through the built-in SPX Player on this Mac.", {
          solution: ["Wait for the SPX Player to connect", "Select a speaker from the device menu"]
        });
        return;
      }
      await controllerPrevious();
      refreshPlayback();
    } catch (e) {
      console.error("Failed to skip previous:", e);
      handleError(e, "Previous Track");
    }
  }, [ensureActiveDevice]);

  const handleSeekPosition = useCallback(async (pos: number) => {
    try {
      await controllerSeek(pos);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to seek:", e);
      handleError(e, "Seek");
    }
  }, []);

  const handleShuffle = useCallback(() => {
    const originalValue = playbackShuffle.value;
    const newValue = !originalValue;

    // Optimistic update
    playbackShuffle.value = newValue;

    ensureActiveDevice()
      .then((deviceId) => {
        if (!deviceId) {
          playbackShuffle.value = originalValue;
          showError("No Active Device", "Select a playback device before toggling shuffle.", {
            solution: ["Wait for the SPX Player to connect", "Select a speaker from the device menu"]
          });
          return;
        }
        return apiSetShuffle(newValue, deviceId).then(() => refreshPlayback());
      })
      .catch((e) => {
        playbackShuffle.value = originalValue;
        console.error("Failed to set shuffle:", e);
        handleError(e, "Shuffle");
      });
  }, [ensureActiveDevice]);

  const handleMuteToggle = useCallback(async () => {
    const currentVol = playbackVolume.value;
    let newVol: number;

    if (currentVol > 0) {
      // Mute: save current volume, set to 0
      prevVolumeRef.current = currentVol;
      newVol = 0;
    } else {
      // Unmute: restore previous volume (or 50% if no previous)
      newVol = prevVolumeRef.current ?? 50;
    }

    try {
      await controllerSetVolume(newVol);
      playbackVolume.value = newVol;
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  }, []);

  const handleRepeat = useCallback(() => {
    const current = playbackRepeat.value;
    const next = current === "off" ? "context" : current === "context" ? "track" : "off";
    const originalValue = current;

    // Optimistic update
    playbackRepeat.value = next;

    ensureActiveDevice()
      .then((deviceId) => {
        if (!deviceId) {
          playbackRepeat.value = originalValue;
          showError("No Active Device", "Select a playback device before toggling repeat.", {
            solution: ["Wait for the SPX Player to connect", "Select a speaker from the device menu"]
          });
          return;
        }
        return apiSetRepeat(next, deviceId).then(() => refreshPlayback());
      })
      .catch((e) => {
        playbackRepeat.value = originalValue;
        console.error("Failed to set repeat:", e);
        handleError(e, "Repeat");
      });
  }, [ensureActiveDevice]);

  return {
    handleNext,
    handlePrev,
    handleSeekPosition,
    handleShuffle,
    handleMuteToggle,
    handleRepeat,
  };
}
