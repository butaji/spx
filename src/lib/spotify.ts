/**
 * Spotify API - Wrapper around Spotify Web SDK
 * 
 * This module re-exports all Spotify functionality from spotify-sdk.ts
 * with the same interface as before for backwards compatibility.
 * 
 * New code should import directly from spotify-sdk.ts
 */

import * as SDK from './spotify-sdk';

// Re-export all SDK functions with same names as before
export const checkMockMode = SDK.isAuthenticated;
export const isMockMode = () => false; // SDK mode is always false
export const isAuthenticated = SDK.isAuthenticated;
export const getAccessToken = () => SDK.isAuthenticated() ? 'sdk-token' : null;
export const clearToken = SDK.logout;
export const restoreSession = async () => SDK.isAuthenticated();
export const validateToken = async () => SDK.isAuthenticated();

// Auth
export const startAuthFlow = SDK.startAuthFlow;
export const handleAuthCallback = SDK.handleAuthCallback;
export const logout = SDK.logout;
export const getCurrentUser = SDK.getCurrentUser;
export const refreshAccessToken = SDK.refreshAccessToken;

// Playback - matching old interface names
export async function getPlaybackState() {
  return SDK.getPlaybackState();
}
export async function play(deviceId?: string) {
  return SDK.play(deviceId);
}
export async function pause(deviceId?: string) {
  return SDK.pause(deviceId);
}
export async function next() {
  return SDK.nextTrack();
}
export async function previous() {
  return SDK.previousTrack();
}
export async function seek(positionMs: number, deviceId?: string) {
  return SDK.seek(positionMs, deviceId);
}
export async function setVolume(volumePercent: number, deviceId?: string) {
  return SDK.setVolume(volumePercent, deviceId);
}
export async function setShuffle(state: boolean) {
  return SDK.toggleShuffle(state);
}
export async function setRepeat(state: string) {
  return SDK.setRepeat(state as 'off' | 'track' | 'context');
}
export async function transferPlayback(deviceId: string, play = true) {
  return SDK.transferPlayback(deviceId, play);
}
export async function playContext(contextUri: string, offsetUri?: string, deviceId?: string) {
  const offset = offsetUri ? parseInt(offsetUri.replace('spotify:track:', ''), 10) : undefined;
  return SDK.playContext(contextUri, offset, deviceId);
}
export async function playUris(uris: string[], offset?: number, deviceId?: string) {
  return SDK.playUris(uris, offset, deviceId);
}
export async function addTracksToPlaylist(_playlistId: string, uris: string[], deviceId?: string) {
  // Note: SDK uses addToQueue, not addToPlaylist
  // This is a simplified implementation - full playlist editing requires Spotify API
  for (const uri of uris) {
    await SDK.addToQueue(uri, deviceId);
  }
}

// Queue
export async function getQueue() {
  return SDK.getMyQueue();
}

// User
export async function getUserProfile() {
  return SDK.getCurrentUser();
}
export async function getUserPlaylists() {
  return SDK.getUserPlaylists();
}
export async function getFollowedArtists() {
  return SDK.getMyFollowedArtists();
}
export async function getTopArtists(limit = 20, timeRange = 'short_term') {
  return SDK.getMyTop('artists', timeRange, limit);
}
export async function getTopTracks(limit = 20, timeRange = 'short_term') {
  return SDK.getMyTop('tracks', timeRange, limit);
}
export async function getRecentlyPlayedTracks(limit = 50) {
  return SDK.getMyRecentlyPlayed(limit);
}

// Browse
export async function getNewReleases(limit = 20) {
  return SDK.getNewReleases(limit);
}
export async function getBrowseCategories(limit = 20) {
  return SDK.getCategories(limit);
}
export async function getCategoryPlaylists(categoryId: string, limit = 20) {
  return SDK.getCategoryPlaylists(categoryId, limit);
}
export async function getRecommendations(options: {
  seedTracks?: string[];
  seedArtists?: string[];
  seedGenres?: string[];
  limit?: number;
} = {}) {
  return SDK.getRecommendations(options);
}

// Search
export async function search(query: string) {
  return SDK.search(query);
}

// Playlists
export async function getPlaylist(playlistId: string) {
  return SDK.getPlaylist(playlistId);
}
export async function getPlaylistTracks(playlistId: string) {
  return SDK.getPlaylistTracks(playlistId);
}

// Albums
export async function getAlbum(albumId: string) {
  return SDK.getAlbum(albumId);
}

// Artists
export async function getArtist(artistId: string) {
  return SDK.getArtist(artistId);
}
export async function getArtistTopTracks(artistId: string) {
  return SDK.getArtistTopTracks(artistId);
}
export async function getArtistAlbums(artistId: string) {
  return SDK.getArtistAlbums(artistId);
}
export async function getArtistRelatedArtists(artistId: string) {
  return SDK.getArtistRelatedArtists(artistId);
}

// Library
export async function getSavedTracks(limit = 20, offset = 0) {
  return SDK.getMySavedTracks(limit, offset);
}
export async function getSavedAlbums(limit = 20, offset = 0) {
  return SDK.getMySavedAlbums(limit, offset);
}
export async function checkSavedTracks(ids: string[]) {
  return SDK.checkSavedTracks(ids);
}
export async function saveTracks(ids: string[]) {
  return SDK.saveTracks(ids);
}
export async function removeSavedTracks(ids: string[]) {
  return SDK.removeTracks(ids);
}

// Audio
export async function getAudioFeatures(trackId: string) {
  return SDK.getAudioFeatures(trackId);
}

// Devices
export async function getAvailableDevices() {
  return SDK.getMyDevices();
}

// Local device scanning - calls Rust backend for mDNS discovery
export async function scanLocalDevices(): Promise<Array<{
  name: string;
  ip: string;
  port: number;
  id?: string;
  friendly_name?: string;
  service_type?: string;
}>> {
  try {
    return await tauriInvoke<any[]>("scan_spotify_devices") || [];
  } catch {
    return [];
  }
}

// Misc
export async function ensureTokenFresh() {
  return SDK.isAuthenticated();
}

// SDK export for direct access if needed
export { SDK as spotifySdk };
export { SDK as default };

// Re-export tauriInvoke for compatibility with stores that need it
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
