/**
 * Spotify API - Wrapper around Spotify Web SDK
 *
 * This module re-exports all Spotify functionality from spotify-sdk.ts
 * with the same interface as before for backwards compatibility.
 *
 * When VITE_SPX_MOCK=1 is active, API calls are routed to the mock stubs
 * in mock.ts instead of hitting the real Spotify Web API.
 *
 * New code should import directly from spotify-sdk.ts
 */

import * as SDK from './spotify-sdk';
import { isMockActive, mock } from './mock';

// Re-export all SDK functions with same names as before
export const checkMockMode = SDK.isAuthenticated;
export const isMockMode = () => isMockActive();
export function isAuthenticated(): boolean {
  if (isMockActive()) return mock.isAuthenticated();
  return SDK.isAuthenticated();
}
export function getAccessToken(): string | null {
  if (isMockActive()) return mock.getAccessToken();
  return SDK.getAccessToken();
}
export const clearToken = SDK.logout;
export const restoreSession = async () => isAuthenticated();
export const validateToken = async () => isAuthenticated();

// Auth
export const startAuthFlow = SDK.startAuthFlow;
export const handleAuthCallback = SDK.handleAuthCallback;
export const logout = SDK.logout;
export async function getCurrentUser(): Promise<any> {
  if (isMockActive()) return mock.getCurrentUser();
  return SDK.getCurrentUser();
}
export const refreshAccessToken = SDK.refreshAccessToken;

// Playback - matching old interface names
export async function getPlaybackState() {
  if (isMockActive()) return mock.getPlaybackState();
  return SDK.getPlaybackState();
}
export async function play(deviceId?: string) {
  if (isMockActive()) return mock.play(deviceId);
  return SDK.play(deviceId);
}
export async function pause(deviceId?: string) {
  if (isMockActive()) return mock.pause(deviceId);
  return SDK.pause(deviceId);
}
export async function next() {
  if (isMockActive()) return mock.nextTrack();
  return SDK.nextTrack();
}
export async function previous() {
  if (isMockActive()) return mock.previousTrack();
  return SDK.previousTrack();
}
export async function seek(positionMs: number, deviceId?: string) {
  if (isMockActive()) return mock.seek(positionMs, deviceId);
  return SDK.seek(positionMs, deviceId);
}
export async function setVolume(volumePercent: number, deviceId?: string) {
  if (isMockActive()) return mock.setVolume(volumePercent, deviceId);
  return SDK.setVolume(volumePercent, deviceId);
}
export async function setShuffle(state: boolean) {
  if (isMockActive()) return mock.toggleShuffle(state);
  return SDK.toggleShuffle(state);
}
export async function setRepeat(state: string) {
  if (isMockActive()) return mock.setRepeat(state as 'off' | 'track' | 'context');
  return SDK.setRepeat(state as 'off' | 'track' | 'context');
}
export async function transferPlayback(deviceId: string, play = true) {
  if (isMockActive()) return mock.transferPlayback(deviceId, play);
  return SDK.transferPlayback(deviceId, play);
}
export async function playContext(contextUri: string, offsetUri?: string, deviceId?: string) {
  if (isMockActive()) return mock.playContext(contextUri, undefined, deviceId);
  // Pass the track URI directly so the SDK can use { uri: offsetUri }.
  return SDK.playContext(contextUri, offsetUri, deviceId);
}
export async function playUris(uris: string[], offset?: number, deviceId?: string) {
  if (isMockActive()) return mock.playUris(uris, offset, deviceId);
  return SDK.playUris(uris, offset, deviceId);
}
export async function addTracksToPlaylist(_playlistId: string, uris: string[], deviceId?: string) {
  if (isMockActive()) {
    for (const uri of uris) {
      await mock.addToQueue(uri, deviceId);
    }
    return;
  }
  // Note: SDK uses addToQueue, not addToPlaylist
  // This is a simplified implementation - full playlist editing requires Spotify API
  for (const uri of uris) {
    await SDK.addToQueue(uri, deviceId);
  }
}

// Queue
export async function getQueue() {
  if (isMockActive()) return mock.getMyQueue() as any;
  return SDK.getMyQueue();
}

// User
export async function getUserProfile(): Promise<any> {
  if (isMockActive()) return mock.getCurrentUser();
  return SDK.getCurrentUser();
}
export async function getUserPlaylists(): Promise<any> {
  if (isMockActive()) return mock.getUserPlaylists();
  return SDK.getUserPlaylists();
}
export async function getFollowedArtists(): Promise<any> {
  if (isMockActive()) return mock.getMyFollowedArtists();
  return SDK.getMyFollowedArtists();
}
export async function getTopArtists(limit = 20, timeRange = 'short_term'): Promise<any> {
  if (isMockActive()) return mock.getMyTop('artists', timeRange, limit);
  return SDK.getMyTop('artists', timeRange, limit);
}
export async function getTopTracks(limit = 20, timeRange = 'short_term'): Promise<any> {
  if (isMockActive()) return mock.getMyTop('tracks', timeRange, limit);
  return SDK.getMyTop('tracks', timeRange, limit);
}
export async function getRecentlyPlayedTracks(limit = 50): Promise<any> {
  if (isMockActive()) return mock.getMyRecentlyPlayed(limit);
  return SDK.getMyRecentlyPlayed(limit);
}

// Browse
export async function getNewReleases(limit = 20): Promise<any> {
  if (isMockActive()) return mock.getNewReleases(limit);
  return SDK.getNewReleases(limit);
}
export async function getBrowseCategories(limit = 20): Promise<any> {
  if (isMockActive()) return mock.getCategories(limit);
  return SDK.getCategories(limit);
}
export async function getCategoryPlaylists(categoryId: string, limit = 20): Promise<any> {
  if (isMockActive()) return mock.getCategoryPlaylists(categoryId, limit);
  return SDK.getCategoryPlaylists(categoryId, limit);
}
export async function getRecommendations(options: {
  seedTracks?: string[];
  seedArtists?: string[];
  seedGenres?: string[];
  limit?: number;
  minEnergy?: number;
  minValence?: number;
} = {}): Promise<any> {
  if (isMockActive()) return mock.getRecommendations(options);
  return SDK.getRecommendations(options);
}

// Search
export async function search(query: string) {
  if (isMockActive()) return mock.search(query) as any;
  return SDK.search(query);
}

// Playlists
export async function getPlaylist(playlistId: string): Promise<any> {
  if (isMockActive()) return mock.getPlaylist(playlistId);
  return SDK.getPlaylist(playlistId);
}
export async function getPlaylistTracks(playlistId: string, limit = 100, offset = 0): Promise<any> {
  if (isMockActive()) return mock.getPlaylistTracks(playlistId, limit, offset);
  return SDK.getPlaylistTracks(playlistId, limit, offset);
}

// Albums
export async function getAlbum(albumId: string): Promise<any> {
  if (isMockActive()) return mock.getAlbum(albumId);
  return SDK.getAlbum(albumId);
}
export async function getAlbumTracks(albumId: string, limit = 50, offset = 0): Promise<any> {
  if (isMockActive()) return mock.getAlbumTracks(albumId, limit, offset);
  return SDK.getAlbumTracks(albumId, limit, offset);
}
export async function getAlbums(ids: string[]): Promise<any> {
  if (isMockActive()) return mock.getAlbums(ids);
  return SDK.getAlbums(ids);
}

// Artists
export async function getArtist(artistId: string): Promise<any> {
  if (isMockActive()) return mock.getArtist(artistId);
  return SDK.getArtist(artistId);
}
export async function getArtistTopTracks(artistId: string, country = 'US'): Promise<any> {
  if (isMockActive()) return mock.getArtistTopTracks(artistId, country);
  return SDK.getArtistTopTracks(artistId, country);
}
export async function getArtistAlbums(artistId: string, options?: { album_type?: string; limit?: number; offset?: number }): Promise<any> {
  if (isMockActive()) return mock.getArtistAlbums(artistId, options);
  return SDK.getArtistAlbums(artistId, options);
}
export async function getArtistRelatedArtists(artistId: string): Promise<any> {
  if (isMockActive()) return mock.getArtistRelatedArtists(artistId);
  return SDK.getArtistRelatedArtists(artistId);
}
export async function getArtists(ids: string[]): Promise<any> {
  if (isMockActive()) return mock.getArtists(ids);
  return SDK.getArtists(ids);
}

// Tracks
export async function getTrack(trackId: string): Promise<any> {
  if (isMockActive()) return mock.getTrack(trackId);
  return SDK.getTrack(trackId);
}
export async function getTracks(ids: string[]): Promise<any> {
  if (isMockActive()) return mock.getTracks(ids);
  return SDK.getTracks(ids);
}
export async function getAudioFeatures(trackId: string): Promise<any> {
  if (isMockActive()) return mock.getAudioFeatures(trackId);
  return SDK.getAudioFeatures(trackId);
}
export async function getAudioFeaturesMultiple(trackIds: string[]): Promise<any> {
  if (isMockActive()) return mock.getAudioFeaturesMultiple(trackIds);
  return SDK.getAudioFeaturesMultiple(trackIds);
}
export async function getAudioAnalysis(trackId: string): Promise<any> {
  if (isMockActive()) return mock.getAudioAnalysis(trackId);
  return SDK.getAudioAnalysis(trackId);
}

// Library
export async function getSavedTracks(limit = 20, offset = 0): Promise<any> {
  if (isMockActive()) return mock.getMySavedTracks(limit, offset);
  return SDK.getMySavedTracks(limit, offset);
}
export async function getSavedAlbums(limit = 20, offset = 0): Promise<any> {
  if (isMockActive()) return mock.getMySavedAlbums(limit, offset);
  return SDK.getMySavedAlbums(limit, offset);
}
export async function checkSavedTracks(ids: string[]): Promise<any> {
  if (isMockActive()) return mock.checkSavedTracks(ids);
  return SDK.checkSavedTracks(ids);
}
export async function saveTracks(ids: string[]): Promise<any> {
  if (isMockActive()) return mock.saveTracks(ids);
  return SDK.saveTracks(ids);
}
export async function removeSavedTracks(ids: string[]): Promise<any> {
  if (isMockActive()) return mock.removeTracks(ids);
  return SDK.removeTracks(ids);
}

// Devices
export async function getAvailableDevices() {
  if (isMockActive()) return mock.getMyDevices();
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
  if (isMockActive()) return [];
  try {
    return await tauriInvoke<any[]>("scan_spotify_devices") || [];
  } catch {
    return [];
  }
}

// Misc
export async function ensureTokenFresh() {
  if (isMockActive()) return true;
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
