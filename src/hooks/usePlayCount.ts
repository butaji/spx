/**
 * usePlayCount - Track play counts for analytics
 * 
 * Records a play after 30 seconds of continuous playback.
 */

import { useEffect, useRef } from "preact/hooks";
import { debug } from "../lib/utils";
import { playbackTrack, isPlaying } from "../stores/spotify";
import { recordPlay } from "../stores/playCounts";

export function usePlayCount() {
  const playCountRecordedRef = useRef(false);
  const playCountTimerRef = useRef<number | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);

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
}
