/**
 * useLikedTrack - Manage liked track state
 * 
 * Handles liked status refresh and toggle.
 */

import { useEffect, useCallback } from "preact/hooks";
import { playbackTrack, likedTrack, refreshLikedStatus } from "../stores/spotify";
import { saveTracks, removeSavedTracks } from "../lib/spotify";
import { handleError } from "../lib/errors";

export function useLikedTrack() {
  // Refresh liked status when track changes
  useEffect(() => {
    const id = playbackTrack.value?.id;
    if (id) {
      refreshLikedStatus(id);
    } else {
      likedTrack.value = false;
    }
  }, [playbackTrack.value?.id]);

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
      handleError(e, "Like Song");
    }
  }, []);

  return {
    liked: likedTrack,
    toggleLike: handleToggleLike,
  };
}
