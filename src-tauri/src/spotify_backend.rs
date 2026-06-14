//! Internal Spotify API functions for use by actors.
//!
//! These functions take a client reference directly and are used
//! by the Spotify actor to perform actual API calls.

use std::sync::Arc;

use rspotify::{
    clients::{BaseClient, OAuthClient},
    http::BaseHttpClient,
    model::{
        AdditionalType, AlbumId, AlbumType, ArtistId, Country, EpisodeId, Market, Offset,
        PlayContextId, PlayableId, PlaylistId, RepeatState, SearchType, TimeRange, TrackId,
    },
    prelude::Id,
};
use serde::Serialize;
use serde_json::Value;

use crate::spotify::Spotify;

fn map_err(e: impl ToString) -> String {
    e.to_string()
}

fn to_value<T: Serialize>(v: T) -> Result<Value, String> {
    serde_json::to_value(v).map_err(map_err)
}

/// Helper to get access token from client
async fn get_access_token(client: &Spotify) -> Result<String, String> {
    let token_arc = client.get_token();
    // Use lock method - this is async-compatible
    let token_guard = token_arc.lock().await
        .map_err(|e| format!("Failed to lock token: {:?}", e))?;
    match token_guard.as_ref() {
        Some(t) => Ok(t.access_token.clone()),
        None => Err("No access token available".to_string()),
    }
}

fn parse_track_id(id: &str) -> Result<TrackId<'static>, String> {
    TrackId::from_id_or_uri(id)
        .map_err(map_err)
        .map(|id| id.into_static())
}

fn parse_playlist_id(id: &str) -> Result<PlaylistId<'static>, String> {
    PlaylistId::from_id_or_uri(id)
        .map_err(map_err)
        .map(|id| id.into_static())
}

fn parse_artist_id(id: &str) -> Result<ArtistId<'static>, String> {
    ArtistId::from_id_or_uri(id)
        .map_err(map_err)
        .map(|id| id.into_static())
}

fn parse_album_id(id: &str) -> Result<AlbumId<'static>, String> {
    AlbumId::from_id_or_uri(id)
        .map_err(map_err)
        .map(|id| id.into_static())
}

fn parse_context_uri(uri: &str) -> Result<PlayContextId<'static>, String> {
    if uri.starts_with("spotify:playlist:") {
        return Ok(PlayContextId::Playlist(
            PlaylistId::from_id_or_uri(uri)
                .map_err(map_err)?
                .into_static(),
        ));
    }
    if uri.starts_with("spotify:album:") {
        return Ok(PlayContextId::Album(
            AlbumId::from_id_or_uri(uri)
                .map_err(map_err)?
                .into_static(),
        ));
    }
    if uri.starts_with("spotify:artist:") {
        return Ok(PlayContextId::Artist(
            ArtistId::from_id_or_uri(uri)
                .map_err(map_err)?
                .into_static(),
        ));
    }
    Err(format!("unsupported context uri: {uri}"))
}

fn parse_playable_id(uri: &str) -> Result<PlayableId<'static>, String> {
    if uri.starts_with("spotify:episode:") {
        Ok(PlayableId::Episode(
            EpisodeId::from_id_or_uri(uri)
                .map_err(map_err)?
                .into_static(),
        ))
    } else {
        Ok(PlayableId::Track(parse_track_id(uri)?))
    }
}

fn parse_time_range(range: &str) -> TimeRange {
    match range {
        "long_term" => TimeRange::LongTerm,
        "medium_term" => TimeRange::MediumTerm,
        _ => TimeRange::ShortTerm,
    }
}

fn parse_repeat_state(mode: &str) -> RepeatState {
    match mode {
        "track" => RepeatState::Track,
        "context" => RepeatState::Context,
        _ => RepeatState::Off,
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEVICE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Serialize, Clone)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub is_active: bool,
    pub volume: i32,
}

pub async fn get_devices_internal(client: &Spotify) -> Result<Vec<DeviceInfo>, String> {
    let devices = crate::spotify::device::available_devices(client)
        .await
        .map_err(map_err)?;
    Ok(devices
        .into_iter()
        .map(|d| DeviceInfo {
            id: d.id,
            name: d.name,
            device_type: "Computer".to_string(),
            is_active: d.is_active,
            volume: 100,
        })
        .collect())
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYBACK FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Serialize)]
pub struct PlaybackState {
    pub item: Option<Value>,
    pub is_playing: bool,
    pub progress_ms: i64,
    pub shuffle_state: bool,
    pub repeat_state: String,
    pub device: Option<Value>,
}

pub async fn get_playback_state_internal(client: &Spotify) -> Result<PlaybackState, String> {
    let playback = client
        .current_playback(Some(Market::FromToken), Some(&[AdditionalType::Track]))
        .await
        .map_err(map_err)?;

    match playback {
        None => Ok(PlaybackState {
            item: None,
            is_playing: false,
            progress_ms: 0,
            shuffle_state: false,
            repeat_state: "off".to_string(),
            device: None,
        }),
        Some(ctx) => {
            let v = to_value(ctx)?;
            Ok(PlaybackState {
                item: v.get("item").cloned(),
                is_playing: v["is_playing"].as_bool().unwrap_or(false),
                progress_ms: v["progress_ms"].as_i64().unwrap_or(0),
                shuffle_state: v["shuffle_state"].as_bool().unwrap_or(false),
                repeat_state: v["repeat_state"].as_str().unwrap_or("off").to_lowercase(),
                device: v.get("device").cloned(),
            })
        }
    }
}

pub async fn play_internal(client: &Spotify) -> Result<(), String> {
    client.resume_playback(None, None).await.map_err(map_err)
}

pub async fn pause_internal(client: &Spotify) -> Result<(), String> {
    client.pause_playback(None).await.map_err(map_err)
}

pub async fn next_track_internal(client: &Spotify) -> Result<(), String> {
    client.next_track(None).await.map_err(map_err)
}

pub async fn prev_track_internal(client: &Spotify) -> Result<(), String> {
    client.previous_track(None).await.map_err(map_err)
}

pub async fn seek_internal(client: &Spotify, ms: i64) -> Result<(), String> {
    client.seek_track(chrono::Duration::milliseconds(ms), None)
        .await
        .map_err(map_err)
}

pub async fn shuffle_internal(client: &Spotify, state: bool) -> Result<(), String> {
    client.shuffle(state, None).await.map_err(map_err)
}

pub async fn repeat_internal(client: &Spotify, mode: &str) -> Result<(), String> {
    client.repeat(parse_repeat_state(mode), None).await.map_err(map_err)
}

pub async fn volume_internal(client: &Spotify, percent: u8) -> Result<(), String> {
    client.volume(percent, None).await.map_err(map_err)
}

pub async fn transfer_internal(client: &Spotify, device_id: &str, play: bool) -> Result<(), String> {
    client.transfer_playback(device_id, Some(play)).await.map_err(map_err)
}

// ══════════════════════════════════════════════════════════════════════════════
// DATA FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

pub async fn get_playlists_internal(client: &Spotify) -> Result<Value, String> {
    let page = client
        .current_user_playlists_manual(Some(50), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_playlist_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let playlist = client
        .playlist(parse_playlist_id(id)?, None, None)
        .await
        .map_err(map_err)?;
    to_value(playlist)
}

pub async fn get_playlist_tracks_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let page = client
        .playlist_items_manual(
            parse_playlist_id(id)?,
            None,
            Some(Market::FromToken),
            Some(100),
            Some(0),
        )
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_album_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let album = client.album(parse_album_id(id)?, None).await.map_err(map_err)?;
    to_value(album)
}

pub async fn get_artist_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let artist = client.artist(parse_artist_id(id)?).await.map_err(map_err)?;
    to_value(artist)
}

pub async fn get_artist_top_tracks_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let tracks = client
        .artist_top_tracks(parse_artist_id(id)?, Some(Market::Country(Country::UnitedStates)))
        .await
        .map_err(map_err)?;
    to_value(tracks)
}

pub async fn get_artist_albums_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let page = client
        .artist_albums_manual(
            parse_artist_id(id)?,
            vec![AlbumType::Album, AlbumType::Single],
            Some(Market::Country(Country::UnitedStates)),
            Some(50),
            Some(0),
        )
        .await
        .map_err(map_err)?;
    to_value(page)
}

#[allow(deprecated)]
pub async fn get_artist_related_artists_internal(client: &Spotify, id: &str) -> Result<Value, String> {
    let artists = client
        .artist_related_artists(parse_artist_id(id)?)
        .await
        .map_err(map_err)?;
    to_value(artists)
}

pub async fn get_saved_tracks_internal(client: &Spotify, limit: u32, offset: u32) -> Result<Value, String> {
    let page = client
        .current_user_saved_tracks_manual(Some(Market::FromToken), Some(limit), Some(offset))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_category_playlists_internal(client: &Spotify, id: &str, limit: u32) -> Result<Value, String> {
    let page = client
        .category_playlists_manual(id, Some(Market::FromToken), Some(limit), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_user_profile_internal(client: &Spotify) -> Result<Value, String> {
    let user = client.current_user().await.map_err(map_err)?;
    to_value(user)
}

pub async fn get_queue_internal(client: &Spotify) -> Result<Value, String> {
    let queue = client.current_user_queue().await.map_err(map_err)?;
    to_value(queue)
}

pub async fn get_recently_played_internal(client: &Spotify, limit: u32) -> Result<Value, String> {
    let page = client
        .current_user_recently_played(Some(limit), None)
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn search_internal(client: &Spotify, query: &str) -> Result<Value, String> {
    let result = client
        .search_multiple(
            query,
            [SearchType::Track, SearchType::Album, SearchType::Artist, SearchType::Playlist],
            Some(Market::FromToken),
            None,
            Some(50),
            Some(0),
        )
        .await
        .map_err(map_err)?;
    to_value(result)
}

pub async fn check_saved_tracks_internal(client: &Spotify, ids: Vec<String>) -> Result<Value, String> {
    let track_ids: Vec<TrackId<'static>> = ids
        .into_iter()
        .map(|id| parse_track_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    let result = client
        .current_user_saved_tracks_contains(track_ids)
        .await
        .map_err(map_err)?;
    to_value(result)
}

pub async fn save_tracks_internal(client: &Spotify, ids: Vec<String>) -> Result<(), String> {
    let track_ids: Vec<TrackId<'static>> = ids
        .into_iter()
        .map(|id| parse_track_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    client.current_user_saved_tracks_add(track_ids)
        .await
        .map_err(map_err)
}

pub async fn remove_saved_tracks_internal(client: &Spotify, ids: Vec<String>) -> Result<(), String> {
    let track_ids: Vec<TrackId<'static>> = ids
        .into_iter()
        .map(|id| parse_track_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    client.current_user_saved_tracks_delete(track_ids)
        .await
        .map_err(map_err)
}

pub async fn get_followed_artists_internal(client: &Spotify) -> Result<Value, String> {
    let page = client
        .current_user_followed_artists(None, Some(50))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_top_artists_internal(client: &Spotify, limit: u32, time_range: &str) -> Result<Value, String> {
    let page = client
        .current_user_top_artists_manual(Some(parse_time_range(time_range)), Some(limit), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_top_tracks_internal(client: &Spotify, limit: u32, time_range: &str) -> Result<Value, String> {
    let page = client
        .current_user_top_tracks_manual(Some(parse_time_range(time_range)), Some(limit), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn play_context_internal(
    client: &Spotify,
    context_uri: &str,
    offset_uri: Option<&str>,
    device_id: Option<&str>,
) -> Result<(), String> {
    let context = parse_context_uri(context_uri)?;
    let offset = offset_uri
        .map(|uri| Ok::<_, String>(Offset::Uri(parse_playable_id(uri)?.uri())))
        .transpose()?;
    client.start_context_playback(context, device_id, offset, None)
        .await
        .map_err(map_err)
}

pub async fn play_uris_internal(
    client: &Spotify,
    uris: Vec<String>,
    offset: Option<i32>,
    device_id: Option<&str>,
) -> Result<(), String> {
    let playable_ids: Vec<PlayableId<'static>> = uris
        .into_iter()
        .map(|uri| parse_playable_id(&uri))
        .collect::<Result<Vec<_>, _>>()?;
    let offset = offset.map(|pos| Offset::Position(chrono::Duration::seconds(pos as i64)));
    client.start_uris_playback(playable_ids, device_id, offset, None)
        .await
        .map_err(map_err)
}

pub async fn add_to_queue_internal(client: &Spotify, uri: &str) -> Result<(), String> {
    let item = parse_playable_id(uri)?;
    client.add_item_to_queue(item, None).await.map_err(map_err)
}

pub async fn get_saved_albums_internal(client: &Spotify, limit: u32) -> Result<Value, String> {
    let page = client
        .current_user_saved_albums_manual(Some(Market::FromToken), Some(limit), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_new_releases_internal(client: &Spotify, limit: u32) -> Result<Value, String> {
    let page = client
        .new_releases_manual(Some(Market::FromToken), Some(limit), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

pub async fn get_categories_internal(client: &Spotify, limit: u32) -> Result<Value, String> {
    let page = client
        .categories_manual(Some("EN"), Some(Market::FromToken), Some(limit), Some(0))
        .await
        .map_err(map_err)?;
    to_value(page)
}

#[allow(deprecated)]
pub async fn get_audio_features_internal(client: &Spotify, track_id: &str) -> Result<Value, String> {
    let features = client.track_features(parse_track_id(track_id)?).await.map_err(map_err)?;
    to_value(features)
}

pub async fn add_tracks_to_playlist_internal(
    client: &Spotify,
    playlist_id: &str,
    uris: Vec<String>,
) -> Result<(), String> {
    let items: Vec<PlayableId<'static>> = uris
        .into_iter()
        .map(|uri| parse_playable_id(&uri))
        .collect::<Result<Vec<_>, _>>()?;
    client.playlist_add_items(parse_playlist_id(playlist_id)?, items, None)
        .await
        .map_err(map_err)?;
    Ok(())
}

pub async fn get_recommendations_internal(
    client: &Spotify,
    seed_tracks: Vec<String>,
    seed_artists: Vec<String>,
    seed_genres: Vec<String>,
    limit: u32,
) -> Result<Value, String> {
    let tracks: Vec<TrackId<'static>> = seed_tracks
        .into_iter()
        .map(|id| parse_track_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    let artists: Vec<ArtistId<'static>> = seed_artists
        .into_iter()
        .map(|id| parse_artist_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    let genres: Vec<&str> = seed_genres.iter().map(|s| s.as_str()).collect();

    let result = client
        .recommendations(
            std::iter::empty::<rspotify::model::RecommendationsAttribute>(),
            Some(artists),
            Some(genres),
            Some(tracks),
            Some(Market::FromToken),
            Some(limit),
        )
        .await
        .map_err(map_err)?;
    to_value(result)
}

pub async fn get_recommendations_for_seeds_internal(
    client: &Spotify,
    seeds: Vec<String>,
    limit: u32,
) -> Result<Value, String> {
    // Parse seeds - they're a mix of track/artist IDs
    let mut track_seeds: Vec<TrackId<'static>> = Vec::new();
    let mut artist_seeds: Vec<ArtistId<'static>> = Vec::new();
    
    for seed in &seeds {
        if let Ok(tid) = parse_track_id(seed) {
            track_seeds.push(tid);
        } else if let Ok(aid) = parse_artist_id(seed) {
            artist_seeds.push(aid);
        }
    }
    
    let genres: Vec<&str> = Vec::new();
    
    let result = client
        .recommendations(
            std::iter::empty::<rspotify::model::RecommendationsAttribute>(),
            Some(artist_seeds),
            Some(genres),
            Some(track_seeds),
            Some(Market::FromToken),
            Some(limit),
        )
        .await
        .map_err(map_err)?;
    to_value(result)
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

/// Audio analysis with detailed timing information (beats, bars, sections, segments)
pub async fn get_audio_analysis_internal(client: &Spotify, track_id: &str) -> Result<Value, String> {
    // Audio analysis is not available in rspotify, so we use the HTTP client directly
    let track = parse_track_id(track_id)?;
    let url = format!("https://api.spotify.com/v1/audio-analysis/{}", track.id());
    
    let http = client.get_http();
    let token = get_access_token(client).await?;
    
    let mut headers = std::collections::HashMap::new();
    headers.insert("Authorization".to_string(), format!("Bearer {}", token));
    
    let query = std::collections::HashMap::new();
    
    let response = http
        .get(&url, Some(&headers), &query)
        .await
        .map_err(map_err)?;
    
    // Parse the response body as JSON
    let json: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(json)
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYLIST EDITING
// ══════════════════════════════════════════════════════════════════════════════

/// Remove tracks from a playlist
pub async fn remove_tracks_from_playlist_internal(
    client: &Spotify,
    playlist_id: &str,
    track_uris: Vec<String>,
) -> Result<Value, String> {
    // Use HTTP client directly for removing tracks since rspotify's API is complex
    let http = client.get_http();
    let token = get_access_token(client).await?;
    
    let url = format!(
        "https://api.spotify.com/v1/playlists/{}/tracks",
        parse_playlist_id(playlist_id)?
    );
    
    let mut headers = std::collections::HashMap::new();
    headers.insert("Authorization".to_string(), format!("Bearer {}", token));
    
    let body = serde_json::json!({
        "tracks": track_uris.iter().map(|uri| {
            serde_json::json!({ "uri": uri })
        }).collect::<Vec<_>>()
    });
    
    let response = http
        .delete(&url, Some(&headers), &body)
        .await
        .map_err(map_err)?;
    
    // Parse the response body as JSON
    let json: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(serde_json::json!({ "success": true, "snapshot_id": json.get("snapshot_id") }))
}

/// Reorder tracks in a playlist
pub async fn reorder_playlist_tracks_internal(
    client: &Spotify,
    playlist_id: &str,
    range_start: u32,
    insert_before: u32,
    range_length: Option<u32>,
) -> Result<Value, String> {
    let snapshot = client
        .playlist_reorder_items(
            parse_playlist_id(playlist_id)?,
            Some(range_start as i32),
            Some(insert_before as i32),
            range_length,
            None,
        )
        .await
        .map_err(map_err)?;
    
    Ok(serde_json::json!({ "snapshot_id": snapshot }))
}

// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW / UNFOLLOW
// ══════════════════════════════════════════════════════════════════════════════

/// Follow an artist
pub async fn follow_artist_internal(client: &Spotify, artist_id: &str) -> Result<(), String> {
    let ids: Vec<ArtistId<'static>> = vec![parse_artist_id(artist_id)?];
    client.user_follow_artists(ids).await.map_err(map_err)
}

/// Unfollow an artist
pub async fn unfollow_artist_internal(client: &Spotify, artist_id: &str) -> Result<(), String> {
    let ids: Vec<ArtistId<'static>> = vec![parse_artist_id(artist_id)?];
    client.user_unfollow_artists(ids).await.map_err(map_err)
}

/// Follow a playlist
pub async fn follow_playlist_internal(client: &Spotify, playlist_id: &str) -> Result<(), String> {
    client
        .playlist_follow(parse_playlist_id(playlist_id)?, Some(true))
        .await
        .map_err(map_err)
}

/// Unfollow a playlist
pub async fn unfollow_playlist_internal(client: &Spotify, playlist_id: &str) -> Result<(), String> {
    client
        .playlist_unfollow(parse_playlist_id(playlist_id)?)
        .await
        .map_err(map_err)
}

/// Check if user follows an artist or user
pub async fn check_is_following_artists_internal(
    client: &Spotify,
    artist_ids: Vec<String>,
) -> Result<Value, String> {
    let ids: Vec<ArtistId<'static>> = artist_ids
        .into_iter()
        .map(|id| parse_artist_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    
    let result = client.user_artist_check_follow(ids).await.map_err(map_err)?;
    to_value(result)
}

/// Check if user follows a playlist
pub async fn check_is_following_playlist_internal(
    client: &Spotify,
    playlist_id: &str,
    user_ids: Vec<String>,
) -> Result<Value, String> {
    use rspotify::model::UserId;
    
    // Parse user IDs, collecting successful ones
    let mut ids: Vec<UserId<'static>> = Vec::new();
    for id in user_ids {
        if let Ok(uid) = UserId::from_id(&id) {
            ids.push(uid.into_static());
        }
    }
    
    let result = client
        .playlist_check_follow(parse_playlist_id(playlist_id)?, &ids)
        .await
        .map_err(map_err)?;
    
    to_value(result)
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURED PLAYLISTS
// ══════════════════════════════════════════════════════════════════════════════

/// Get featured playlists (Spotify's editorial playlists)
pub async fn get_featured_playlists_internal(
    client: &Spotify,
    limit: u32,
    offset: u32,
) -> Result<Value, String> {
    use rspotify::model::Market;
    use chrono::Utc;
    
    let result = client
        .featured_playlists(Some("EN"), Some(Market::FromToken), Some(Utc::now()), Some(limit), Some(offset))
        .await
        .map_err(map_err)?;
    
    to_value(result)
}

// ══════════════════════════════════════════════════════════════════════════════
// LIKED SONGS (additional helpers)
// ══════════════════════════════════════════════════════════════════════════════

/// Check if specific tracks are in the user's liked songs
pub async fn check_liked_songs_internal(
    client: &Spotify,
    track_ids: Vec<String>,
) -> Result<Vec<bool>, String> {
    let ids: Vec<TrackId<'static>> = track_ids
        .into_iter()
        .map(|id| parse_track_id(&id))
        .collect::<Result<Vec<_>, _>>()?;
    
    let result = client
        .current_user_saved_tracks_contains(ids)
        .await
        .map_err(map_err)?;
    
    Ok(result)
}

pub async fn validate_token_internal(client: &Spotify) -> Result<bool, String> {
    client.current_user().await.map(|_| true).map_err(map_err)
}

// ══════════════════════════════════════════════════════════════════════════════
// LYRICS
// ══════════════════════════════════════════════════════════════════════════════

/// Lyric line with timing information
#[derive(Debug, Clone, Serialize)]
pub struct LyricLine {
    /// Time tag in format "MM:SS.xx" (e.g., "00:01.23")
    pub time_tag: String,
    /// The lyric text
    pub words: String,
    /// Start time in milliseconds (for easier calculation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_time_ms: Option<i64>,
}

/// Lyrics response
#[derive(Debug, Clone, Serialize)]
pub struct LyricsResponse {
    /// Sync type: "LINE_SYNCED", "UNSYNCED", or "NOT_FOUND"
    pub sync_type: String,
    /// Whether lyrics were found
    pub available: bool,
    /// Lines of lyrics
    pub lines: Vec<LyricLine>,
}

impl LyricsResponse {
    /// Parse lyrics from Spotify's internal API response
    pub fn from_spotify_response(json: Value) -> Self {
        let sync_type = json
            .get("syncType")
            .or_else(|| json.get("data",))
            .and_then(|d| d.get("syncType"))
            .and_then(|v| v.as_str())
            .unwrap_or("NOT_FOUND")
            .to_string();
        
        let lines: Vec<LyricLine> = json
            .get("lines")
            .or_else(|| json.get("data").and_then(|d| d.get("lines")))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|line| {
                        let words = line.get("words")?.as_str()?.to_string();
                        let time_tag = line.get("timeTag")?.as_str()?.to_string();
                        
                        // Parse time tag to milliseconds
                        let start_time_ms = parse_time_tag(&time_tag);
                        
                        Some(LyricLine {
                            time_tag,
                            words,
                            start_time_ms,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        
        let available = !lines.is_empty() || sync_type != "NOT_FOUND";
        
        LyricsResponse {
            sync_type,
            available,
            lines,
        }
    }
}

/// Parse time tag "MM:SS.xx" to milliseconds
fn parse_time_tag(time_tag: &str) -> Option<i64> {
    let parts: Vec<&str> = time_tag.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let minutes: i64 = parts[0].parse().ok()?;
    let seconds_parts: Vec<&str> = parts[1].split('.').collect();
    let seconds: i64 = seconds_parts[0].parse().ok()?;
    let centiseconds: i64 = seconds_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    
    Some(minutes * 60 * 1000 + seconds * 1000 + centiseconds * 10)
}

/// Get synchronized lyrics for a track from Spotify's internal API
pub async fn get_lyrics_internal(
    client: &Spotify,
    track_id: &str,
) -> Result<LyricsResponse, String> {
    let track = parse_track_id(track_id)?;
    let url = format!(
        "https://spclient.wg.spotify.com/color-lyrics/v2/track/{}?format=json&vocalRemoval=false",
        track.id()
    );
    
    let http = client.get_http();
    let token = get_access_token(client).await?;
    
    let mut headers = std::collections::HashMap::new();
    headers.insert("Authorization".to_string(), format!("Bearer {}", token));
    headers.insert("app-platform".to_string(), "WebPlayer".to_string());
    
    let query = std::collections::HashMap::new();
    
    let response = http
        .get(&url, Some(&headers), &query)
        .await
        .map_err(map_err)?;
    
    // Parse the response body as JSON
    let json: Value = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse lyrics response: {}", e))?;
    
    Ok(LyricsResponse::from_spotify_response(json))
}

// ─── Client Management (for Tauri commands) ─────────────────────────────────

static CLIENT: std::sync::OnceLock<tokio::sync::Mutex<Option<Arc<Spotify>>>> = std::sync::OnceLock::new();

fn client_guard() -> &'static tokio::sync::Mutex<Option<Arc<Spotify>>> {
    CLIENT.get_or_init(|| tokio::sync::Mutex::new(None))
}

pub async fn install_client(client: Arc<Spotify>) {
    *client_guard().lock().await = Some(client);
}

pub async fn clear_client() {
    *client_guard().lock().await = None;
}

pub async fn current_token() -> Result<Option<rspotify::Token>, String> {
    let client = {
        let guard = client_guard().lock().await;
        match guard.as_ref() {
            Some(c) => c.clone(),
            None => return Ok(None),
        }
    };
    
    // Get token arc and keep client alive while locking
    let token_arc = client.get_token().clone();
    let token_guard = token_arc.lock().await;
    match token_guard {
        Ok(token) => Ok(token.clone()),
        Err(_) => Ok(None),
    }
}

pub async fn get_client() -> Result<Arc<Spotify>, String> {
    client_guard()
        .lock()
        .await
        .clone()
        .ok_or_else(|| "Spotify client not initialized".to_string())
}
