import { useState, useCallback, useEffect, useRef } from "preact/compat";
import { debug } from "../lib/utils";
import {
  setShuffle as apiSetShuffle, setRepeat as apiSetRepeat,
  playContext, playUris, transferPlayback,
  saveTracks,
  removeSavedTracks,
} from "../lib/spotify";
import {
  controllerNext,
  controllerPrevious,
  controllerSeek,
  controllerSetVolume,
} from "../lib/playerController";
import {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  isPlaying,
  likedTrack,
  appError,
  refreshPlayback,
  refreshLikedStatus,
  playTrack,
  pauseTrack,
  startPlaybackPolling,
} from "../stores/spotify";
import { availableDevices, refreshSpotifyDevices } from "../stores/devices";
import { recordPlay } from "../stores/playCounts";

interface UsePlaybackOptions {
  ensureActiveDevice: () => Promise<string | null>;
}

export function usePlayback({ ensureActiveDevice }: UsePlaybackOptions) {
  const [isPlayActionLoading, setIsPlayActionLoading] = useState(false);
  const isPlayActionLoadingRef = useRef(isPlayActionLoading);
  isPlayActionLoadingRef.current = isPlayActionLoading;

  // Shuffle/Repeat debounce refs
  const shufflePendingRef = useRef(false);
  const shuffleTimeoutRef = useRef<number | null>(null);
  const repeatPendingRef = useRef(false);
  const repeatTimeoutRef = useRef<number | null>(null);

  // Play count tracking refs
  const playCountRecordedRef = useRef(false);
  const playCountTimerRef = useRef<number | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);

  // Error helper using dialog
  const showError = useCallback(async (msg: string) => {
    console.error(msg);
    try {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(msg, { title: 'SPX Error', kind: 'error' });
    } catch (e) {
      appError.value = msg;
    }
  }, []);

  // Start playback polling
  useEffect(() => {
    const cleanup = startPlaybackPolling();
    return cleanup;
  }, []);

  // Cleanup debounced timers on unmount
  useEffect(() => {
    return () => {
      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current);
        shuffleTimeoutRef.current = null;
      }
      if (repeatTimeoutRef.current) {
        clearTimeout(repeatTimeoutRef.current);
        repeatTimeoutRef.current = null;
      }
    };
  }, []);

  // Refresh liked status when track changes
  useEffect(() => {
    const id = playbackTrack.value?.id;
    if (id) {
      refreshLikedStatus(id);
    } else {
      likedTrack.value = false;
    }
  }, [playbackTrack.value?.id]);

  // Track play counts - record after 30 seconds of playback
  useEffect(() => {
    const track = playbackTrack.value;
    const playing = isPlaying.value;
    const trackId = track?.id;

    // Clear any existing timer
    if (playCountTimerRef.current) {
      clearTimeout(playCountTimerRef.current);
      playCountTimerRef.current = null;
    }

    // If track changed or playback stopped then started again, reset
    if (trackId !== currentTrackIdRef.current || (!wasPlayingRef.current && playing)) {
      playCountRecordedRef.current = false;
      currentTrackIdRef.current = trackId ?? null;
    }
    wasPlayingRef.current = playing;

    // If playing and haven't recorded yet, set timer for 30 seconds
    if (playing && trackId && !playCountRecordedRef.current) {
      playCountTimerRef.current = window.setTimeout(() => {
        const currentTrack = playbackTrack.value;
        if (isPlaying.value && currentTrack?.id === trackId) {
          const artistName = currentTrack?.artists?.map(a => a.name).join(", ") || "Unknown";
          const trackName = currentTrack?.name || "Unknown";
          recordPlay(artistName, trackName);
          playCountRecordedRef.current = true;
          debug(`[PlayCount] Recorded play: ${artistName} - ${trackName}`);
        }
      }, 30000);
    }

    return () => {
      if (playCountTimerRef.current) {
        clearTimeout(playCountTimerRef.current);
        playCountTimerRef.current = null;
      }
    };
  }, [playbackTrack.value?.id, isPlaying.value]);

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
      if (playing) {
        debug('[Play/Pause] Calling pauseTrack()...');
        await pauseTrack();
        debug('[Play/Pause] pauseTrack() succeeded');
      } else {
        debug('[Play/Pause] Need to play, checking devices...');

        await refreshSpotifyDevices();
        debug('[Play/Pause] Devices:', availableDevices.value.length, 'found');
        debug('[Play/Pause] Devices list:', availableDevices.value.map(d => ({ name: d.name, id: d.id, is_active: d.is_active })));

        const activeDevice = availableDevices.value.find(d => d.is_active);
        debug('[Play/Pause] Active device:', activeDevice);

        let deviceId: string | null = null;

        if (activeDevice?.id) {
          deviceId = activeDevice.id;
          debug('[Play/Pause] Using active device:', deviceId);
        } else {
          debug('[Play/Pause] No active device, trying first available...');
          const firstDevice = availableDevices.value[0];
          if (firstDevice?.id) {
            debug('[Play/Pause] Transferring to:', firstDevice.id);
            try {
              await transferPlayback(firstDevice.id, false);
              await new Promise(r => setTimeout(r, 500));
              deviceId = firstDevice.id;
              debug('[Play/Pause] Transfer succeeded');
            } catch (e) {
              console.warn('[Play/Pause] Transfer failed:', e);
            }
          } else {
            console.warn('[Play/Pause] NO DEVICES FOUND');
          }
        }

        if (!deviceId) {
          console.warn('[Play/Pause] Cannot play - no device available');
          isPlaying.value = playing;
          showError("No Spotify devices found. Open Spotify on your phone or computer.");
          return;
        }

        debug('[Play/Pause] Calling playTrack()...');
        await playTrack();
        debug('[Play/Pause] playTrack() succeeded');
      }

      setTimeout(() => {
        debug('[Play/Pause] Refreshing playback state...');
        refreshPlayback();
      }, 500);
    } catch (error) {
      console.error('[Play/Pause] ERROR:', error);
      // Revert optimistic update on any error.
      isPlaying.value = playing;
    } finally {
      debug('[Play/Pause] Setting loading to false');
      setIsPlayActionLoading(false);
    }
  }, [ensureActiveDevice, showError]);

  const handleNext = useCallback(async () => {
    try {
      const hasDevice = await ensureActiveDevice();
      if (!hasDevice) {
        showError("No active device. Please open Spotify on a device first.");
        return;
      }
      await controllerNext();
      refreshPlayback();
    } catch (e) {
      console.error("Failed to skip next:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureActiveDevice, showError]);

  const handlePrev = useCallback(async () => {
    try {
      const hasDevice = await ensureActiveDevice();
      if (!hasDevice) {
        showError("No active device. Please open Spotify on a device first.");
        return;
      }
      await controllerPrevious();
      refreshPlayback();
    } catch (e) {
      console.error("Failed to skip previous:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureActiveDevice, showError]);

  const handleSeekPosition = useCallback(async (pos: number) => {
    try {
      await controllerSeek(pos);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to seek:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [showError]);

  const handleShuffle = useCallback(async () => {
    // Cancel any pending API call
    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current);
    }

    const originalValue = playbackShuffle.value;
    const newValue = !originalValue;

    // Optimistic update
    playbackShuffle.value = newValue;
    shufflePendingRef.current = true;

    // Debounce: wait 300ms before calling API
    shuffleTimeoutRef.current = window.setTimeout(async () => {
      try {
        await apiSetShuffle(newValue);
        shufflePendingRef.current = false;
      } catch (e) {
        // Revert on error
        playbackShuffle.value = originalValue;
        shufflePendingRef.current = false;
        console.error("Failed to set shuffle:", e);
        showError(e instanceof Error ? e.message : String(e));
      }
    }, 300);
  }, [showError]);

  const handleMuteToggle = useCallback(async () => {
    const v = playbackVolume.value > 0 ? 0 : 74;
    try {
      await controllerSetVolume(v);
      playbackVolume.value = v;
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  }, []);

  const handleRepeat = useCallback(async () => {
    // Cancel any pending API call
    if (repeatTimeoutRef.current) {
      clearTimeout(repeatTimeoutRef.current);
    }

    const current = playbackRepeat.value;
    const next = current === "off" ? "context" : current === "context" ? "track" : "off";
    const originalValue = current;

    // Optimistic update
    playbackRepeat.value = next;
    repeatPendingRef.current = true;

    // Debounce: wait 300ms before calling API
    repeatTimeoutRef.current = window.setTimeout(async () => {
      try {
        await apiSetRepeat(next);
        repeatPendingRef.current = false;
      } catch (e) {
        // Revert on error
        playbackRepeat.value = originalValue;
        repeatPendingRef.current = false;
        console.error("Failed to set repeat:", e);
        showError(e instanceof Error ? e.message : String(e));
      }
    }, 300);
  }, [showError]);

  const playContextFn = useCallback(async (uri: string, offsetUri?: string) => {
    try {
      const deviceId = await ensureActiveDevice();
      if (!deviceId) {
        showError("No active device. Please open Spotify on a device first.");
        return;
      }
      await playContext(uri, offsetUri, deviceId);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to play context:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureActiveDevice, showError]);

  const playUrisFn = useCallback(async (uris: string[], offset?: number) => {
    try {
      const deviceId = await ensureActiveDevice();
      if (!deviceId) {
        showError("No active device. Please open Spotify on a device first.");
        return;
      }
      await playUris(uris, offset, deviceId);
      refreshPlayback();
    } catch (e) {
      console.error("Failed to play URIs:", e);
      showError(e instanceof Error ? e.message : String(e));
    }
  }, [ensureActiveDevice, showError]);

  const adjustVolume = useCallback(async (delta: number) => {
    const v = Math.max(0, Math.min(100, playbackVolume.value + delta));
    try {
      await controllerSetVolume(v);
      playbackVolume.value = v;
    } catch (ev) {
      console.error("Failed to adjust volume:", ev);
    }
  }, []);

  const handleToggleLike = useCallback(async () => {
    const id = playbackTrack.value?.id;
    if (!id) return;
    try {
      if (likedTrack.value) {
        await removeSavedTracks([id]);
        likedTrack.value = false;
      } else {
        await saveTracks([id]);
        likedTrack.value = true;
      }
    } catch (e) {
      console.error("Failed to toggle like:", e);
      showError("Failed to update liked status");
    }
  }, [showError]);

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
    handleNext,
    handlePrev,
    handleSeekPosition,
    handleShuffle,
    handleMuteToggle,
    handleRepeat,
    playContextFn,
    playUrisFn,
    adjustVolume,
    handleToggleLike,
    handleVolumeChange,
  };
}
