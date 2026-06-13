// Barrel file: re-exports all domain stores for backward compatibility.
// Prefer importing from specific store modules (auth, playback, user, content).

export {
  authState,
  isMockMode,
  authError,
  isAuthLoading,
  isRestoring,
  appError,
  validateToken,
  clearToken,
} from "./auth";

export {
  playbackTrack,
  playbackVolume,
  playbackShuffle,
  playbackRepeat,
  playbackProgress,
  playbackDuration,
  isPlaying,
  likedTrack,
  refreshPlayback,
  startPlaybackPolling,
  playTrack,
  pauseTrack,
  refreshLikedStatus,
} from "./playback";

export {
  userProfile,
  topArtists,
  topTracks,
  followedArtists,
  savedAlbums,
  loadUserProfile,
  loadTopArtists,
  loadTopTracks,
  loadFollowedArtists,
  loadSavedAlbums,
  loadFollowedArtistsFromCache,
  loadSavedAlbumsFromCache,
} from "./user";

export {
  userPlaylists,
  playbackQueue,
  queueCurrentTrack,
  currentArtist,
  artistTopTracks,
  artistAlbums,
  recentContainers,
  categoryPlaylists,
  newReleases,
  homeFeed,
  lastPlayedTrack,
  contextPanelItem,
  navigationHistory,
  loadUserPlaylists,
  loadQueue,
  loadArtist,
  loadRecentContainers,
  buildHomeFeed,
  loadRecentActivity,
  loadCategoryPlaylists,
  loadNewReleases,
  type RecentContainer,
  type HomeFeedItem,
  type LastPlayedTrack,
} from "./content";

import { playbackTrack, playbackVolume, playbackShuffle, playbackRepeat, playbackProgress, playbackDuration, isPlaying, likedTrack } from "./playback";
import { authState, isAuthLoading, authError, appError } from "./auth";
import { userProfile } from "./user";
import { userPlaylists, playbackQueue, queueCurrentTrack, currentArtist, artistTopTracks, artistAlbums, recentContainers, categoryPlaylists, newReleases, homeFeed, lastPlayedTrack, contextPanelItem, navigationHistory } from "./content";
import { followedArtists, savedAlbums } from "./user";

export function clearStore(): void {
  playbackTrack.value = null;
  playbackVolume.value = 100;
  playbackShuffle.value = false;
  playbackRepeat.value = "off";
  playbackProgress.value = 0;
  playbackDuration.value = 0;
  isPlaying.value = false;
  likedTrack.value = false;
  authState.value = false;
  userProfile.value = null;
  isAuthLoading.value = false;
  authError.value = null;
  appError.value = null;
  userPlaylists.value = [];
  playbackQueue.value = [];
  queueCurrentTrack.value = null;
  currentArtist.value = null;
  artistTopTracks.value = [];
  artistAlbums.value = [];
  recentContainers.value = [];
  categoryPlaylists.value = [];
  newReleases.value = [];
  homeFeed.value = [];
  lastPlayedTrack.value = null;
  contextPanelItem.value = null;
  navigationHistory.value = [];
  followedArtists.value = [];
  savedAlbums.value = [];
}
