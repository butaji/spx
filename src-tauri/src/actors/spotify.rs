//! Spotify actor that manages all Spotify-related state and operations.
//!
//! This actor holds:
//! - The Spotify client (rspotify)
//! - Cached playback state
//! - Device information
//! - User profile data
//! - Token state
//!
//! # Architecture
//!
//! ```text
//! ws_server ──Message──► SpotifyActor
//!                              │
//!                         ┌────┴────┐
//!                      State     API Call
//!                         │
//!                      Response
//! ```

use std::sync::Arc;
use tokio::task::spawn;
use tokio::sync::{RwLock, oneshot};
use serde::{Serialize, Deserialize};

use super::{Handler, Message};
use crate::spotify::Spotify;

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

/// Cached playback state for efficient polling.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlaybackCache {
    pub track_id: Option<String>,
    pub track_name: Option<String>,
    pub artist_name: Option<String>,
    pub album_name: Option<String>,
    pub album_image: Option<String>,
    pub is_playing: bool,
    pub progress_ms: i64,
    pub duration_ms: i64,
    pub shuffle_state: bool,
    pub repeat_state: String,
    pub volume: i32,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub context_uri: Option<String>,
    pub updated_at: Option<u64>, // Unix timestamp
}

impl PlaybackCache {
    pub fn mark_updated(&mut self) {
        self.updated_at = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
    }
}

/// Device information cache.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeviceCache {
    pub devices: Vec<DeviceInfo>,
    pub active_id: Option<String>,
    pub updated_at: Option<u64>,
}

impl DeviceCache {
    pub fn mark_updated(&mut self) {
        self.updated_at = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
    }
}

/// A device visible to Spotify Connect.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub is_active: bool,
    pub volume: i32,
    pub can_transfer: bool,
}

/// Cached user profile.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserCache {
    pub id: Option<String>,
    pub display_name: Option<String>,
    pub images: Vec<String>,
    pub country: Option<String>,
    pub product: Option<String>,
    pub updated_at: Option<u64>,
}

impl UserCache {
    pub fn mark_updated(&mut self) {
        self.updated_at = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
    }
}

/// Token state for authentication management.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenState {
    pub access_token: Option<String>,
    pub expires_at: Option<u64>,
    pub is_valid: bool,
}

impl Default for TokenState {
    fn default() -> Self {
        Self {
            access_token: None,
            expires_at: None,
            is_valid: false,
        }
    }
}

/// The complete state held by the Spotify actor.
#[derive(Debug, Clone)]
pub struct SpotifyState {
    pub client: Option<Arc<Spotify>>,
    pub playback: PlaybackCache,
    pub devices: DeviceCache,
    pub user: UserCache,
    pub token: TokenState,
    pub is_initialized: bool,
    pub is_mock: bool,
}

impl Default for SpotifyState {
    fn default() -> Self {
        Self {
            client: None,
            playback: PlaybackCache::default(),
            devices: DeviceCache::default(),
            user: UserCache::default(),
            token: TokenState::default(),
            is_initialized: false,
            is_mock: false,
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGES - Each message includes its reply channel
// ══════════════════════════════════════════════════════════════════════════════

// ─── Auth Messages ────────────────────────────────────────────────────────────

pub struct Init {
    pub token_json: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for Init {
    type Response = ();
}

pub struct RestoreSession {
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for RestoreSession {
    type Response = ();
}

pub struct ClearSession {
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for ClearSession {
    type Response = ();
}

pub struct ValidateToken {
    pub reply: oneshot::Sender<Result<bool, String>>,
}

impl Message for ValidateToken {
    type Response = ();
}

// ─── Playback Messages ───────────────────────────────────────────────────────

pub struct GetPlayback {
    pub reply: oneshot::Sender<Result<PlaybackCache, String>>,
}

impl Message for GetPlayback {
    type Response = ();
}

pub struct Play {
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for Play {
    type Response = ();
}

pub struct Pause {
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for Pause {
    type Response = ();
}

pub struct NextTrack {
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for NextTrack {
    type Response = ();
}

pub struct PrevTrack {
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for PrevTrack {
    type Response = ();
}

pub struct Seek {
    pub position_ms: i64,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for Seek {
    type Response = ();
}

pub struct SetVolume {
    pub percent: u8,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for SetVolume {
    type Response = ();
}

pub struct SetShuffle {
    pub state: bool,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for SetShuffle {
    type Response = ();
}

pub struct SetRepeat {
    pub mode: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for SetRepeat {
    type Response = ();
}

pub struct TransferPlayback {
    pub device_id: String,
    pub play: bool,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for TransferPlayback {
    type Response = ();
}

pub struct PlayContext {
    pub uri: String,
    pub offset_uri: Option<String>,
    pub device_id: Option<String>,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for PlayContext {
    type Response = ();
}

pub struct PlayUris {
    pub uris: Vec<String>,
    pub offset: Option<i32>,
    pub device_id: Option<String>,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for PlayUris {
    type Response = ();
}

pub struct AddToQueue {
    pub uri: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for AddToQueue {
    type Response = ();
}

pub struct GetQueue {
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetQueue {
    type Response = ();
}

// ─── Device Messages ─────────────────────────────────────────────────────────

pub struct GetDevices {
    pub reply: oneshot::Sender<Result<DeviceCache, String>>,
}

impl Message for GetDevices {
    type Response = ();
}

pub struct RefreshDevices {
    pub reply: oneshot::Sender<Result<DeviceCache, String>>,
}

impl Message for RefreshDevices {
    type Response = ();
}

// ─── Data Messages ───────────────────────────────────────────────────────────

pub struct GetUserProfile {
    pub reply: oneshot::Sender<Result<UserCache, String>>,
}

impl Message for GetUserProfile {
    type Response = ();
}

pub struct GetPlaylists {
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetPlaylists {
    type Response = ();
}

pub struct GetPlaylist {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetPlaylist {
    type Response = ();
}

pub struct GetPlaylistTracks {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetPlaylistTracks {
    type Response = ();
}

pub struct GetAlbum {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetAlbum {
    type Response = ();
}

pub struct GetArtist {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetArtist {
    type Response = ();
}

pub struct GetArtistTopTracks {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetArtistTopTracks {
    type Response = ();
}

pub struct GetArtistAlbums {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetArtistAlbums {
    type Response = ();
}

pub struct GetArtistRelatedArtists {
    pub id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetArtistRelatedArtists {
    type Response = ();
}

pub struct Search {
    pub query: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for Search {
    type Response = ();
}

pub struct GetRecentlyPlayed {
    pub limit: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetRecentlyPlayed {
    type Response = ();
}

pub struct GetTopArtists {
    pub limit: u32,
    pub time_range: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetTopArtists {
    type Response = ();
}

pub struct GetTopTracks {
    pub limit: u32,
    pub time_range: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetTopTracks {
    type Response = ();
}

pub struct GetFollowedArtists {
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetFollowedArtists {
    type Response = ();
}

pub struct GetSavedTracks {
    pub limit: u32,
    pub offset: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetSavedTracks {
    type Response = ();
}

pub struct GetSavedAlbums {
    pub limit: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetSavedAlbums {
    type Response = ();
}

pub struct GetNewReleases {
    pub limit: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetNewReleases {
    type Response = ();
}

pub struct GetCategories {
    pub limit: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetCategories {
    type Response = ();
}

pub struct GetCategoryPlaylists {
    pub category_id: String,
    pub limit: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetCategoryPlaylists {
    type Response = ();
}

pub struct GetAudioFeatures {
    pub track_id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetAudioFeatures {
    type Response = ();
}

pub struct GetRecommendations {
    pub seed_tracks: Vec<String>,
    pub seed_artists: Vec<String>,
    pub seed_genres: Vec<String>,
    pub limit: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetRecommendations {
    type Response = ();
}

// ─── Library Messages ─────────────────────────────────────────────────────────

pub struct CheckSavedTracks {
    pub ids: Vec<String>,
    pub reply: oneshot::Sender<Result<Vec<bool>, String>>,
}

impl Message for CheckSavedTracks {
    type Response = ();
}

pub struct SaveTracks {
    pub ids: Vec<String>,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for SaveTracks {
    type Response = ();
}

pub struct RemoveSavedTracks {
    pub ids: Vec<String>,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for RemoveSavedTracks {
    type Response = ();
}

pub struct AddTracksToPlaylist {
    pub playlist_id: String,
    pub uris: Vec<String>,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for AddTracksToPlaylist {
    type Response = ();
}

// ─── Playlist Editing Messages ────────────────────────────────────────────────

pub struct RemoveTracksFromPlaylist {
    pub playlist_id: String,
    pub track_uris: Vec<String>,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for RemoveTracksFromPlaylist {
    type Response = ();
}

pub struct ReorderPlaylistTracks {
    pub playlist_id: String,
    pub range_start: u32,
    pub insert_before: u32,
    pub range_length: Option<u32>,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for ReorderPlaylistTracks {
    type Response = ();
}

// ─── Audio Analysis Messages ─────────────────────────────────────────────────

pub struct GetAudioAnalysis {
    pub track_id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetAudioAnalysis {
    type Response = ();
}

// ─── Follow/Unfollow Messages ─────────────────────────────────────────────────

pub struct FollowArtist {
    pub artist_id: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for FollowArtist {
    type Response = ();
}

pub struct UnfollowArtist {
    pub artist_id: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for UnfollowArtist {
    type Response = ();
}

pub struct FollowPlaylist {
    pub playlist_id: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for FollowPlaylist {
    type Response = ();
}

pub struct UnfollowPlaylist {
    pub playlist_id: String,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for UnfollowPlaylist {
    type Response = ();
}

pub struct CheckIsFollowingArtists {
    pub artist_ids: Vec<String>,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for CheckIsFollowingArtists {
    type Response = ();
}

pub struct CheckIsFollowingPlaylist {
    pub playlist_id: String,
    pub user_ids: Vec<String>,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for CheckIsFollowingPlaylist {
    type Response = ();
}

// ─── Featured Playlists Message ──────────────────────────────────────────────

pub struct GetFeaturedPlaylists {
    pub limit: u32,
    pub offset: u32,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetFeaturedPlaylists {
    type Response = ();
}

// ─── Check Liked Songs (returns Vec<bool>) ─────────────────────────────────

pub struct CheckLikedSongs {
    pub track_ids: Vec<String>,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for CheckLikedSongs {
    type Response = ();
}

// ─── Get Lyrics ─────────────────────────────────────────────────────────────

pub struct GetLyrics {
    pub track_id: String,
    pub reply: oneshot::Sender<Result<serde_json::Value, String>>,
}

impl Message for GetLyrics {
    type Response = ();
}

// ─── State Messages ───────────────────────────────────────────────────────────

pub struct GetStateSnapshot {
    pub reply: oneshot::Sender<SpotifyState>,
}

impl Message for GetStateSnapshot {
    type Response = ();
}

pub struct SetMockMode {
    pub enabled: bool,
    pub reply: oneshot::Sender<Result<(), String>>,
}

impl Message for SetMockMode {
    type Response = ();
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTOR IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════════

/// The Spotify actor that processes all Spotify-related commands.
#[derive(Debug)]
pub struct SpotifyActor {
    state: Arc<RwLock<SpotifyState>>,
}

impl SpotifyActor {
    pub fn new() -> Self {
        Self {
            state: Arc::new(RwLock::new(SpotifyState::default())),
        }
    }

    pub fn state(&self) -> Arc<RwLock<SpotifyState>> {
        Arc::clone(&self.state)
    }

    #[allow(dead_code)]
    async fn client(&self) -> Result<Arc<Spotify>, String> {
        let state = self.state.read().await;
        state.client
            .clone()
            .ok_or_else(|| "Spotify client not initialized".to_string())
    }

    #[allow(dead_code)]
    async fn refresh_playback_cache(&self) -> Result<PlaybackCache, String> {
        let client = self.client().await?;
        let playback = crate::spotify_backend::get_playback_state_internal(&client).await?;
        
        let mut cache = PlaybackCache {
            track_id: playback.item.as_ref().and_then(|i| i.get("id").and_then(|id| id.as_str().map(String::from))),
            track_name: playback.item.as_ref().and_then(|i| i.get("name").and_then(|n| n.as_str().map(String::from))),
            artist_name: playback.item.as_ref().and_then(|i| {
                i.get("artists").and_then(|a| a.get(0))
            }).and_then(|a| a.get("name")).and_then(|n| n.as_str().map(String::from)),
            album_name: playback.item.as_ref().and_then(|i| {
                i.get("album").and_then(|a| a.get("name"))
            }).and_then(|n| n.as_str().map(String::from)),
            album_image: playback.item.as_ref().and_then(|i| {
                i.get("album").and_then(|a| a.get("images"))
            }).and_then(|imgs| imgs.get(0)).and_then(|img| {
                img.get("url")
            }).and_then(|u| u.as_str().map(String::from)),
            is_playing: playback.is_playing,
            progress_ms: playback.progress_ms,
            duration_ms: playback.item.as_ref().and_then(|i| {
                i.get("duration_ms")
            }).and_then(|d| d.as_i64()).unwrap_or(0),
            shuffle_state: playback.shuffle_state,
            repeat_state: playback.repeat_state,
            volume: playback.device.as_ref().and_then(|d| {
                d.get("volume_percent")
            }).and_then(|v| v.as_i64()).unwrap_or(100) as i32,
            device_id: playback.device.as_ref().and_then(|d| {
                d.get("id")
            }).and_then(|id| id.as_str().map(String::from)),
            device_name: playback.device.as_ref().and_then(|d| {
                d.get("name")
            }).and_then(|n| n.as_str().map(String::from)),
            context_uri: None,
            updated_at: None,
        };
        
        cache.mark_updated();
        let mut state = self.state.write().await;
        state.playback = cache.clone();
        Ok(cache)
    }

    #[allow(dead_code)]
    async fn refresh_device_cache(&self) -> Result<DeviceCache, String> {
        let client = self.client().await?;
        let devices = crate::spotify_backend::get_devices_internal(&client).await?;
        
        let active_id = devices.iter().find(|d| d.is_active).map(|d| d.id.clone());
        
        let mut cache = DeviceCache {
            devices: devices.into_iter().map(|d| DeviceInfo {
                id: d.id,
                name: d.name,
                device_type: d.device_type,
                is_active: d.is_active,
                volume: d.volume,
                can_transfer: true,
            }).collect(),
            active_id,
            updated_at: None,
        };
        
        let mut state = self.state.write().await;
        cache.mark_updated();
        state.devices = cache.clone();
        Ok(cache)
    }

    #[allow(dead_code)]
    async fn refresh_user_cache(&self) -> Result<UserCache, String> {
        let client = self.client().await?;
        let profile = crate::spotify_backend::get_user_profile_internal(&client).await?;
        
        let mut cache = UserCache {
            id: profile.get("id").and_then(|v| v.as_str()).map(String::from),
            display_name: profile.get("display_name").and_then(|v| v.as_str()).map(String::from),
            images: profile.get("images")
                .and_then(|imgs| imgs.as_array())
                .map(|arr| arr.iter().filter_map(|img| {
                    img.get("url").and_then(|u| u.as_str().map(String::from))
                }).collect())
                .unwrap_or_default(),
            country: profile.get("country").and_then(|v| v.as_str()).map(String::from),
            product: profile.get("product").and_then(|v| v.as_str()).map(String::from),
            updated_at: None,
        };
        
        let mut state = self.state.write().await;
        cache.mark_updated();
        state.user = cache.clone();
        Ok(cache)
    }
}

impl Default for SpotifyActor {
    fn default() -> Self {
        Self::new()
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Auth Handlers ───────────────────────────────────────────────────────────

impl Handler<Init> for SpotifyActor {
    fn handle(&mut self, msg: Init) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = if msg.token_json.is_empty() {
                match crate::spotify::new_spotify_client(true).await {
                    Ok(client) => {
                        let mut s = state.write().await;
                        s.client = Some(Arc::new(client));
                        s.is_initialized = true;
                        Ok(())
                    }
                    Err(e) => Err(e.to_string()),
                }
            } else {
                match serde_json::from_str::<rspotify::Token>(&msg.token_json) {
                    Ok(token) => {
                        let mut spotify = Spotify::new();
                        spotify.set_token_refreshing(false);
                        spotify.set_token(token).await;
                        
                        let mut s = state.write().await;
                        s.client = Some(Arc::new(spotify));
                        s.is_initialized = true;
                        s.token = TokenState {
                            access_token: Some(msg.token_json.clone()),
                            expires_at: None,
                            is_valid: true,
                        };
                        Ok(())
                    }
                    Err(e) => Err(e.to_string()),
                }
            };
            
            msg.reply.send(result).ok();
        });
    }
}

impl Handler<RestoreSession> for SpotifyActor {
    fn handle(&mut self, msg: RestoreSession) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match crate::spotify::new_spotify_client(false).await {
                Ok(client) => {
                    let mut s = state.write().await;
                    s.client = Some(Arc::new(client));
                    s.is_initialized = true;
                    Ok(())
                }
                Err(e) => Err(e.to_string()),
            };
            
            msg.reply.send(result).ok();
        });
    }
}

impl Handler<ClearSession> for SpotifyActor {
    fn handle(&mut self, msg: ClearSession) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let mut s = state.write().await;
            s.client = None;
            s.is_initialized = false;
            s.token = TokenState::default();
            msg.reply.send(Ok(())).ok();
        });
    }
}

impl Handler<ValidateToken> for SpotifyActor {
    fn handle(&mut self, msg: ValidateToken) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => {
                    crate::spotify_backend::validate_token_internal(&client).await
                }
                None => Ok(false),
            };
            
            match result {
                Ok(valid) => msg.reply.send(Ok(valid)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Playback Handlers ───────────────────────────────────────────────────────

impl Handler<GetPlayback> for SpotifyActor {
    fn handle(&mut self, msg: GetPlayback) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let cache = {
                let s = state.read().await;
                s.playback.clone()
            };
            
            // Return cache if fresh (within 5 seconds)
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            let is_fresh = cache.updated_at.map(|t| now - t < 5).unwrap_or(false);
            
            let final_result = if is_fresh {
                Ok(cache)
            } else {
                // Inline refresh logic to avoid borrowing self
                let result = async {
                    let client = state.read().await.client.clone()
                        .ok_or_else(|| "Client not initialized".to_string())?;
                    crate::spotify_backend::get_playback_state_internal(&client).await
                }.await;
                
                match result {
                    Ok(playback) => {
                        let mut new_cache = PlaybackCache {
                            track_id: playback.item.as_ref().and_then(|i| i.get("id").and_then(|id| id.as_str().map(String::from))),
                            track_name: playback.item.as_ref().and_then(|i| i.get("name").and_then(|n| n.as_str().map(String::from))),
                            artist_name: playback.item.as_ref().and_then(|i| i.get("artists").and_then(|a| a.get(0))).and_then(|a| a.get("name")).and_then(|n| n.as_str().map(String::from)),
                            album_name: playback.item.as_ref().and_then(|i| i.get("album").and_then(|a| a.get("name"))).and_then(|n| n.as_str().map(String::from)),
                            album_image: playback.item.as_ref().and_then(|i| i.get("album").and_then(|a| a.get("images"))).and_then(|imgs| imgs.get(0)).and_then(|img| img.get("url")).and_then(|u| u.as_str().map(String::from)),
                            is_playing: playback.is_playing,
                            progress_ms: playback.progress_ms,
                            duration_ms: playback.item.as_ref().and_then(|i| i.get("duration_ms")).and_then(|d| d.as_i64()).unwrap_or(0),
                            shuffle_state: playback.shuffle_state,
                            repeat_state: playback.repeat_state,
                            volume: playback.device.as_ref().and_then(|d| d.get("volume_percent")).and_then(|v| v.as_i64()).unwrap_or(100) as i32,
                            device_id: playback.device.as_ref().and_then(|d| d.get("id")).and_then(|id| id.as_str().map(String::from)),
                            device_name: playback.device.as_ref().and_then(|d| d.get("name")).and_then(|n| n.as_str().map(String::from)),
                            context_uri: None,
                            updated_at: None,
                        };
                        new_cache.mark_updated();
                        let cache_clone = new_cache.clone();
                        
                        // Update state
                        let mut s = state.write().await;
                        s.playback = new_cache;
                        
                        Ok(cache_clone)
                    }
                    Err(e) => Err(e),
                }
            };
            
            match final_result {
                Ok(c) => msg.reply.send(Ok(c)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<Play> for SpotifyActor {
    fn handle(&mut self, msg: Play) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::play_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.playback.is_playing = true;
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<Pause> for SpotifyActor {
    fn handle(&mut self, msg: Pause) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::pause_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.playback.is_playing = false;
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<NextTrack> for SpotifyActor {
    fn handle(&mut self, msg: NextTrack) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::next_track_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<PrevTrack> for SpotifyActor {
    fn handle(&mut self, msg: PrevTrack) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::prev_track_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<Seek> for SpotifyActor {
    fn handle(&mut self, msg: Seek) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::seek_internal(&client, msg.position_ms).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.playback.progress_ms = msg.position_ms;
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<SetVolume> for SpotifyActor {
    fn handle(&mut self, msg: SetVolume) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::volume_internal(&client, msg.percent).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.playback.volume = msg.percent as i32;
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<SetShuffle> for SpotifyActor {
    fn handle(&mut self, msg: SetShuffle) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::shuffle_internal(&client, msg.state).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.playback.shuffle_state = msg.state;
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<SetRepeat> for SpotifyActor {
    fn handle(&mut self, msg: SetRepeat) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::repeat_internal(&client, &msg.mode).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.playback.repeat_state = msg.mode.clone();
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<TransferPlayback> for SpotifyActor {
    fn handle(&mut self, msg: TransferPlayback) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::transfer_internal(&client, &msg.device_id, msg.play).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => {
                    let mut s = state.write().await;
                    s.devices.active_id = Some(msg.device_id.clone());
                    s.playback.device_id = Some(msg.device_id);
                    msg.reply.send(Ok(())).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<PlayContext> for SpotifyActor {
    fn handle(&mut self, msg: PlayContext) {
        let state = Arc::clone(&self.state);
        let uri = msg.uri.clone();
        let offset_uri = msg.offset_uri.clone();
        let device_id = msg.device_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => {
                    crate::spotify_backend::play_context_internal(&client, &uri, offset_uri.as_deref(), device_id.as_deref()).await
                }
                None => Err("Client not initialized".to_string()),
            };
            
            // Inline refresh on success
            if result.is_ok() {
                if let Some(client) = state.read().await.client.clone() {
                    if let Ok(playback) = crate::spotify_backend::get_playback_state_internal(&client).await {
                        let mut cache = PlaybackCache {
                            track_id: playback.item.as_ref().and_then(|i| i.get("id").and_then(|id| id.as_str().map(String::from))),
                            track_name: playback.item.as_ref().and_then(|i| i.get("name").and_then(|n| n.as_str().map(String::from))),
                            artist_name: playback.item.as_ref().and_then(|i| i.get("artists").and_then(|a| a.get(0))).and_then(|a| a.get("name")).and_then(|n| n.as_str().map(String::from)),
                            album_name: playback.item.as_ref().and_then(|i| i.get("album").and_then(|a| a.get("name"))).and_then(|n| n.as_str().map(String::from)),
                            album_image: playback.item.as_ref().and_then(|i| i.get("album").and_then(|a| a.get("images"))).and_then(|imgs| imgs.get(0)).and_then(|img| img.get("url")).and_then(|u| u.as_str().map(String::from)),
                            is_playing: playback.is_playing,
                            progress_ms: playback.progress_ms,
                            duration_ms: playback.item.as_ref().and_then(|i| i.get("duration_ms")).and_then(|d| d.as_i64()).unwrap_or(0),
                            shuffle_state: playback.shuffle_state,
                            repeat_state: playback.repeat_state,
                            volume: playback.device.as_ref().and_then(|d| d.get("volume_percent")).and_then(|v| v.as_i64()).unwrap_or(100) as i32,
                            device_id: playback.device.as_ref().and_then(|d| d.get("id")).and_then(|id| id.as_str().map(String::from)),
                            device_name: playback.device.as_ref().and_then(|d| d.get("name")).and_then(|n| n.as_str().map(String::from)),
                            context_uri: None,
                            updated_at: None,
                        };
                        cache.mark_updated();
                        let mut s = state.write().await;
                        s.playback = cache;
                    }
                }
            }
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<PlayUris> for SpotifyActor {
    fn handle(&mut self, msg: PlayUris) {
        let state = Arc::clone(&self.state);
        let uris = msg.uris.clone();
        let offset = msg.offset;
        let device_id = msg.device_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => {
                    crate::spotify_backend::play_uris_internal(&client, uris, offset, device_id.as_deref()).await
                }
                None => Err("Client not initialized".to_string()),
            };
            
            // Inline refresh on success
            if result.is_ok() {
                if let Some(client) = state.read().await.client.clone() {
                    if let Ok(playback) = crate::spotify_backend::get_playback_state_internal(&client).await {
                        let mut cache = PlaybackCache {
                            track_id: playback.item.as_ref().and_then(|i| i.get("id").and_then(|id| id.as_str().map(String::from))),
                            track_name: playback.item.as_ref().and_then(|i| i.get("name").and_then(|n| n.as_str().map(String::from))),
                            artist_name: playback.item.as_ref().and_then(|i| i.get("artists").and_then(|a| a.get(0))).and_then(|a| a.get("name")).and_then(|n| n.as_str().map(String::from)),
                            album_name: playback.item.as_ref().and_then(|i| i.get("album").and_then(|a| a.get("name"))).and_then(|n| n.as_str().map(String::from)),
                            album_image: playback.item.as_ref().and_then(|i| i.get("album").and_then(|a| a.get("images"))).and_then(|imgs| imgs.get(0)).and_then(|img| img.get("url")).and_then(|u| u.as_str().map(String::from)),
                            is_playing: playback.is_playing,
                            progress_ms: playback.progress_ms,
                            duration_ms: playback.item.as_ref().and_then(|i| i.get("duration_ms")).and_then(|d| d.as_i64()).unwrap_or(0),
                            shuffle_state: playback.shuffle_state,
                            repeat_state: playback.repeat_state,
                            volume: playback.device.as_ref().and_then(|d| d.get("volume_percent")).and_then(|v| v.as_i64()).unwrap_or(100) as i32,
                            device_id: playback.device.as_ref().and_then(|d| d.get("id")).and_then(|id| id.as_str().map(String::from)),
                            device_name: playback.device.as_ref().and_then(|d| d.get("name")).and_then(|n| n.as_str().map(String::from)),
                            context_uri: None,
                            updated_at: None,
                        };
                        cache.mark_updated();
                        let mut s = state.write().await;
                        s.playback = cache;
                    }
                }
            }
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<AddToQueue> for SpotifyActor {
    fn handle(&mut self, msg: AddToQueue) {
        let state = Arc::clone(&self.state);
        let uri = msg.uri.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::add_to_queue_internal(&client, &uri).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetQueue> for SpotifyActor {
    fn handle(&mut self, msg: GetQueue) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_queue_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Device Handlers ─────────────────────────────────────────────────────────

impl Handler<GetDevices> for SpotifyActor {
    fn handle(&mut self, msg: GetDevices) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let cache = {
                let s = state.read().await;
                s.devices.clone()
            };
            
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            let is_fresh = cache.updated_at.map(|t| now - t < 10).unwrap_or(false);
            
            if is_fresh {
                msg.reply.send(Ok(cache)).ok()
            } else {
                // Inline device cache refresh
                let result = async {
                    let client = state.read().await.client.clone()
                        .ok_or_else(|| "Client not initialized".to_string())?;
                    crate::spotify_backend::get_devices_internal(&client).await
                }.await;
                
                match result {
                    Ok(devices) => {
                        let active_id = devices.iter().find(|d| d.is_active).map(|d| d.id.clone());
                        let mut cache = DeviceCache {
                            devices: devices.into_iter().map(|d| DeviceInfo {
                                id: d.id,
                                name: d.name,
                                device_type: d.device_type,
                                is_active: d.is_active,
                                volume: d.volume,
                                can_transfer: true,
                            }).collect(),
                            active_id,
                            updated_at: None,
                        };
                        cache.mark_updated();
                        let cache_clone = cache.clone();
                        let mut s = state.write().await;
                        s.devices = cache;
                        msg.reply.send(Ok(cache_clone)).ok()
                    }
                    Err(e) => msg.reply.send(Err(e)).ok(),
                }
            }
        });
    }
}

impl Handler<RefreshDevices> for SpotifyActor {
    fn handle(&mut self, msg: RefreshDevices) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            // Inline device cache refresh
            let result = async {
                let client = state.read().await.client.clone()
                    .ok_or_else(|| "Client not initialized".to_string())?;
                crate::spotify_backend::get_devices_internal(&client).await
            }.await;
            
            match result {
                Ok(devices) => {
                    let active_id = devices.iter().find(|d| d.is_active).map(|d| d.id.clone());
                    let mut cache = DeviceCache {
                        devices: devices.into_iter().map(|d| DeviceInfo {
                            id: d.id,
                            name: d.name,
                            device_type: d.device_type,
                            is_active: d.is_active,
                            volume: d.volume,
                            can_transfer: true,
                        }).collect(),
                        active_id,
                        updated_at: None,
                    };
                    cache.mark_updated();
                    let cache_clone = cache.clone();
                    let mut s = state.write().await;
                    s.devices = cache;
                    msg.reply.send(Ok(cache_clone)).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── User Profile Handler ─────────────────────────────────────────────────────

impl Handler<GetUserProfile> for SpotifyActor {
    fn handle(&mut self, msg: GetUserProfile) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let cache = {
                let s = state.read().await;
                s.user.clone()
            };
            
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            let is_fresh = cache.updated_at.map(|t| now - t < 300).unwrap_or(false); // 5 min TTL
            
            if is_fresh {
                msg.reply.send(Ok(cache)).ok()
            } else {
                // Inline user cache refresh
                let result = async {
                    let client = state.read().await.client.clone()
                        .ok_or_else(|| "Client not initialized".to_string())?;
                    crate::spotify_backend::get_user_profile_internal(&client).await
                }.await;
                
                match result {
                    Ok(profile) => {
                        let mut cache = UserCache {
                            id: profile.get("id").and_then(|v| v.as_str()).map(String::from),
                            display_name: profile.get("display_name").and_then(|v| v.as_str()).map(String::from),
                            images: profile.get("images")
                                .and_then(|imgs| imgs.as_array())
                                .map(|arr| arr.iter().filter_map(|img| {
                                    img.get("url").and_then(|u| u.as_str().map(String::from))
                                }).collect())
                                .unwrap_or_default(),
                            country: profile.get("country").and_then(|v| v.as_str()).map(String::from),
                            product: profile.get("product").and_then(|v| v.as_str()).map(String::from),
                            updated_at: None,
                        };
                        cache.mark_updated();
                        let cache_clone = cache.clone();
                        let mut s = state.write().await;
                        s.user = cache;
                        msg.reply.send(Ok(cache_clone)).ok()
                    }
                    Err(e) => msg.reply.send(Err(e)).ok(),
                }
            }
        });
    }
}

// ─── Data Handlers ───────────────────────────────────────────────────────────
// Note: Macros removed - using inline implementations for consistency

impl Handler<GetPlaylists> for SpotifyActor {
    fn handle(&mut self, msg: GetPlaylists) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_playlists_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetPlaylist> for SpotifyActor {
    fn handle(&mut self, msg: GetPlaylist) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_playlist_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetPlaylistTracks> for SpotifyActor {
    fn handle(&mut self, msg: GetPlaylistTracks) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_playlist_tracks_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetAlbum> for SpotifyActor {
    fn handle(&mut self, msg: GetAlbum) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_album_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetArtist> for SpotifyActor {
    fn handle(&mut self, msg: GetArtist) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_artist_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetArtistTopTracks> for SpotifyActor {
    fn handle(&mut self, msg: GetArtistTopTracks) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_artist_top_tracks_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetArtistAlbums> for SpotifyActor {
    fn handle(&mut self, msg: GetArtistAlbums) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_artist_albums_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetArtistRelatedArtists> for SpotifyActor {
    fn handle(&mut self, msg: GetArtistRelatedArtists) {
        let state = Arc::clone(&self.state);
        let id = msg.id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_artist_related_artists_internal(&client, &id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<Search> for SpotifyActor {
    fn handle(&mut self, msg: Search) {
        let state = Arc::clone(&self.state);
        let query = msg.query.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::search_internal(&client, &query).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetRecentlyPlayed> for SpotifyActor {
    fn handle(&mut self, msg: GetRecentlyPlayed) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_recently_played_internal(&client, limit).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetTopArtists> for SpotifyActor {
    fn handle(&mut self, msg: GetTopArtists) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        let time_range = msg.time_range.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_top_artists_internal(&client, limit, &time_range).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetTopTracks> for SpotifyActor {
    fn handle(&mut self, msg: GetTopTracks) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        let time_range = msg.time_range.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_top_tracks_internal(&client, limit, &time_range).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetFollowedArtists> for SpotifyActor {
    fn handle(&mut self, msg: GetFollowedArtists) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_followed_artists_internal(&client).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetSavedTracks> for SpotifyActor {
    fn handle(&mut self, msg: GetSavedTracks) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        let offset = msg.offset;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_saved_tracks_internal(&client, limit, offset).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetSavedAlbums> for SpotifyActor {
    fn handle(&mut self, msg: GetSavedAlbums) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_saved_albums_internal(&client, limit).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetNewReleases> for SpotifyActor {
    fn handle(&mut self, msg: GetNewReleases) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_new_releases_internal(&client, limit).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetCategories> for SpotifyActor {
    fn handle(&mut self, msg: GetCategories) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_categories_internal(&client, limit).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetCategoryPlaylists> for SpotifyActor {
    fn handle(&mut self, msg: GetCategoryPlaylists) {
        let state = Arc::clone(&self.state);
        let category_id = msg.category_id.clone();
        let limit = msg.limit;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_category_playlists_internal(&client, &category_id, limit).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetAudioFeatures> for SpotifyActor {
    fn handle(&mut self, msg: GetAudioFeatures) {
        let state = Arc::clone(&self.state);
        let track_id = msg.track_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_audio_features_internal(&client, &track_id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<GetRecommendations> for SpotifyActor {
    fn handle(&mut self, msg: GetRecommendations) {
        let state = Arc::clone(&self.state);
        let seed_tracks = msg.seed_tracks.clone();
        let seed_artists = msg.seed_artists.clone();
        let seed_genres = msg.seed_genres.clone();
        let limit = msg.limit;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_recommendations_internal(&client, seed_tracks, seed_artists, seed_genres, limit).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Library Handlers ────────────────────────────────────────────────────────

impl Handler<CheckSavedTracks> for SpotifyActor {
    fn handle(&mut self, msg: CheckSavedTracks) {
        let state = Arc::clone(&self.state);
        let ids = msg.ids.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::check_saved_tracks_internal(&client, ids).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => {
                    let bools: Vec<bool> = serde_json::from_value(data).unwrap_or_default();
                    msg.reply.send(Ok(bools)).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<SaveTracks> for SpotifyActor {
    fn handle(&mut self, msg: SaveTracks) {
        let state = Arc::clone(&self.state);
        let ids = msg.ids.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::save_tracks_internal(&client, ids).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<RemoveSavedTracks> for SpotifyActor {
    fn handle(&mut self, msg: RemoveSavedTracks) {
        let state = Arc::clone(&self.state);
        let ids = msg.ids.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::remove_saved_tracks_internal(&client, ids).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<AddTracksToPlaylist> for SpotifyActor {
    fn handle(&mut self, msg: AddTracksToPlaylist) {
        let state = Arc::clone(&self.state);
        let playlist_id = msg.playlist_id.clone();
        let uris = msg.uris.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::add_tracks_to_playlist_internal(&client, &playlist_id, uris).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── State Handlers ──────────────────────────────────────────────────────────

impl Handler<GetStateSnapshot> for SpotifyActor {
    fn handle(&mut self, msg: GetStateSnapshot) {
        let state = Arc::clone(&self.state);
        
        spawn(async move {
            let s = state.read().await;
            msg.reply.send((*s).clone()).ok();
        });
    }
}

impl Handler<SetMockMode> for SpotifyActor {
    fn handle(&mut self, msg: SetMockMode) {
        let state = Arc::clone(&self.state);
        let enabled = msg.enabled;
        
        spawn(async move {
            let mut s = state.write().await;
            s.is_mock = enabled;
            msg.reply.send(Ok(())).ok();
        });
    }
}

// ─── Playlist Editing Handlers ─────────────────────────────────────────────────

impl Handler<RemoveTracksFromPlaylist> for SpotifyActor {
    fn handle(&mut self, msg: RemoveTracksFromPlaylist) {
        let state = Arc::clone(&self.state);
        let playlist_id = msg.playlist_id.clone();
        let track_uris = msg.track_uris.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::remove_tracks_from_playlist_internal(&client, &playlist_id, track_uris).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<ReorderPlaylistTracks> for SpotifyActor {
    fn handle(&mut self, msg: ReorderPlaylistTracks) {
        let state = Arc::clone(&self.state);
        let playlist_id = msg.playlist_id.clone();
        let range_start = msg.range_start;
        let insert_before = msg.insert_before;
        let range_length = msg.range_length;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::reorder_playlist_tracks_internal(&client, &playlist_id, range_start, insert_before, range_length).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Audio Analysis Handler ────────────────────────────────────────────────────

impl Handler<GetAudioAnalysis> for SpotifyActor {
    fn handle(&mut self, msg: GetAudioAnalysis) {
        let state = Arc::clone(&self.state);
        let track_id = msg.track_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_audio_analysis_internal(&client, &track_id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Follow/Unfollow Handlers ──────────────────────────────────────────────────

impl Handler<FollowArtist> for SpotifyActor {
    fn handle(&mut self, msg: FollowArtist) {
        let state = Arc::clone(&self.state);
        let artist_id = msg.artist_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::follow_artist_internal(&client, &artist_id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<UnfollowArtist> for SpotifyActor {
    fn handle(&mut self, msg: UnfollowArtist) {
        let state = Arc::clone(&self.state);
        let artist_id = msg.artist_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::unfollow_artist_internal(&client, &artist_id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<FollowPlaylist> for SpotifyActor {
    fn handle(&mut self, msg: FollowPlaylist) {
        let state = Arc::clone(&self.state);
        let playlist_id = msg.playlist_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::follow_playlist_internal(&client, &playlist_id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<UnfollowPlaylist> for SpotifyActor {
    fn handle(&mut self, msg: UnfollowPlaylist) {
        let state = Arc::clone(&self.state);
        let playlist_id = msg.playlist_id.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::unfollow_playlist_internal(&client, &playlist_id).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(()) => msg.reply.send(Ok(())).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<CheckIsFollowingArtists> for SpotifyActor {
    fn handle(&mut self, msg: CheckIsFollowingArtists) {
        let state = Arc::clone(&self.state);
        let artist_ids = msg.artist_ids.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::check_is_following_artists_internal(&client, artist_ids).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

impl Handler<CheckIsFollowingPlaylist> for SpotifyActor {
    fn handle(&mut self, msg: CheckIsFollowingPlaylist) {
        let state = Arc::clone(&self.state);
        let playlist_id = msg.playlist_id.clone();
        let user_ids = msg.user_ids.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::check_is_following_playlist_internal(&client, &playlist_id, user_ids).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Featured Playlists Handler ───────────────────────────────────────────────

impl Handler<GetFeaturedPlaylists> for SpotifyActor {
    fn handle(&mut self, msg: GetFeaturedPlaylists) {
        let state = Arc::clone(&self.state);
        let limit = msg.limit;
        let offset = msg.offset;
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::get_featured_playlists_internal(&client, limit, offset).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Check Liked Songs Handler ─────────────────────────────────────────────────

impl Handler<CheckLikedSongs> for SpotifyActor {
    fn handle(&mut self, msg: CheckLikedSongs) {
        let state = Arc::clone(&self.state);
        let track_ids = msg.track_ids.clone();
        
        spawn(async move {
            let result = match state.read().await.client.clone() {
                Some(client) => crate::spotify_backend::check_liked_songs_internal(&client, track_ids).await,
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => {
                    let json = serde_json::json!(data);
                    msg.reply.send(Ok(json)).ok()
                }
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}

// ─── Get Lyrics Handler ─────────────────────────────────────────────────────

impl Handler<GetLyrics> for SpotifyActor {
    fn handle(&mut self, msg: GetLyrics) {
        let state = Arc::clone(&self.state);
        let track_id = msg.track_id.clone();
        
        spawn(async move {
            let result: Result<serde_json::Value, String> = match state.read().await.client.clone() {
                Some(client) => {
                    match crate::spotify_backend::get_lyrics_internal(&client, &track_id).await {
                        Ok(lyrics) => serde_json::to_value(lyrics).map_err(|e| e.to_string()),
                        Err(e) => Err(e),
                    }
                }
                None => Err("Client not initialized".to_string()),
            };
            
            match result {
                Ok(data) => msg.reply.send(Ok(data)).ok(),
                Err(e) => msg.reply.send(Err(e)).ok(),
            }
        });
    }
}
