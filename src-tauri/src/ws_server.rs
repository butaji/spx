//! WebSocket server with actor-based message handling.
//!
//! This module implements a WebSocket server that routes commands
//! to the Spotify actor for processing.

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::{broadcast, oneshot};
use tokio_tungstenite::accept_async;
use tracing::{debug, error, info, warn};

use crate::actors::spotify::SpotifyActor;
use crate::actors::Handler;

// ══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVER
// ══════════════════════════════════════════════════════════════════════════════

/// Shared broadcast sender for playback events
type PlaybackBroadcast = broadcast::Sender<String>;

/// Run the WebSocket server with the Spotify actor.
pub async fn run_server() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let addr = "127.0.0.1:1424";
    info!("WS: attempting to bind to {}", addr);
    let listener = TcpListener::bind(addr).await?;
    info!("WS: listening on {}", addr);

    // Create shared actor state
    let actor_state = Arc::new(tokio::sync::Mutex::new(SpotifyActor::new()));
    
    // Broadcast channel for playback events
    let (broadcast_tx, _) = broadcast::channel::<String>(100);

    loop {
        tokio::select! {
            // Accept new connections
            result = listener.accept() => {
                match result {
                    Ok((stream, peer_addr)) => {
                        info!("WS: new connection from {peer_addr}");
                        let broadcast_tx = broadcast_tx.clone();
                        let actor_state = Arc::clone(&actor_state);
                        
                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(stream, broadcast_tx, actor_state).await {
                                warn!("WS: connection error: {e}");
                            }
                        });
                    }
                    Err(e) => {
                        error!("WS: accept error: {e}");
                    }
                }
            }
        }
    }
}

/// Handle a single WebSocket connection.
async fn handle_connection(
    stream: tokio::net::TcpStream,
    broadcast_tx: PlaybackBroadcast,
    actor_state: Arc<tokio::sync::Mutex<SpotifyActor>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws = accept_async(stream).await?;
    let (mut ws_sender, mut ws_receiver) = ws.split();
    let (msg_tx, msg_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Clone broadcast receiver for this connection
    let mut broadcast_rx = broadcast_tx.subscribe();

    // Task to send messages to the WebSocket (from both regular and broadcast)
    let send_task = tokio::spawn(async move {
        // Channel for regular messages
        let mut msg_rx = msg_rx;
        
        loop {
            tokio::select! {
                Some(msg) = msg_rx.recv() => {
                    if ws_sender.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
                Ok(broadcast_msg) = broadcast_rx.recv() => {
                    if ws_sender.send(tokio_tungstenite::tungstenite::Message::Text(broadcast_msg)).await.is_err() {
                        break;
                    }
                }
                else => break,
            }
        }
    });

    // Process incoming messages
    while let Some(msg) = ws_receiver.next().await {
        let text = match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(t)) => t.to_string(),
            Ok(tokio_tungstenite::tungstenite::Message::Binary(b)) => {
                match String::from_utf8(b) {
                    Ok(s) => s,
                    Err(_) => continue,
                }
            }
            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => break,
            Err(e) => {
                error!("WS: read error: {e}");
                break;
            }
            _ => continue,
        };

        // Parse command
        let cmd: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(e) => {
                debug!("WS: parse error: {e}");
                let response = serde_json::json!({
                    "ok": false,
                    "error": format!("Invalid JSON: {}", e),
                    "action": "parse"
                });
                msg_tx.send(response.to_string()).ok();
                continue;
            }
        };

        let id = cmd.get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let action = cmd.get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Handle command
        let response_json = process_command(&actor_state, &broadcast_tx, &cmd, &id, &action).await;
        msg_tx.send(response_json.to_string()).ok();
    }

    send_task.abort();
    Ok(())
}

/// Process a command and return the JSON response.
async fn process_command(
    actor_state: &Arc<tokio::sync::Mutex<SpotifyActor>>,
    broadcast_tx: &PlaybackBroadcast,
    cmd: &Value,
    id: &str,
    action: &str,
) -> Value {
    let mut actor = actor_state.lock().await;
    
    match action {
        // Subscribe to playback events (real-time updates)
        "subscribe" => {
            // Client subscribed - they will receive broadcast events
            // Just acknowledge the subscription
            serde_json::json!({ "ok": true, "id": id, "action": action, "subscribed": true })
        }
        
        // Auth commands
        "init" => {
            let token = cmd.get("token").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let (reply_tx, _reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::Init { 
                token_json: token, 
                reply: reply_tx 
            });
            serde_json::json!({ "ok": true, "id": id, "action": action })
        }
        
        "restore_session" => {
            let (reply_tx, _reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::RestoreSession { reply: reply_tx });
            serde_json::json!({ "ok": true, "id": id, "action": action })
        }
        
        "clear_session" => {
            let (reply_tx, _reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::ClearSession { reply: reply_tx });
            serde_json::json!({ "ok": true, "id": id, "action": action })
        }
        
        "validate_token" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::ValidateToken { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(valid)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": valid }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Playback commands
        "get_playback" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::GetPlayback { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(cache)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": cache }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "play" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::Play { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => {
                    // Broadcast playback update to all subscribers
                    let bt = broadcast_tx.clone();
                    let as_ref = Arc::clone(actor_state);
                    tokio::spawn(async move {
                        broadcast_playback_update(&as_ref, &bt).await;
                    });
                    serde_json::json!({ "ok": true, "id": id, "action": action })
                }
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "pause" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::Pause { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => {
                    // Broadcast playback update to all subscribers
                    let bt = broadcast_tx.clone();
                    let as_ref = Arc::clone(actor_state);
                    tokio::spawn(async move {
                        broadcast_playback_update(&as_ref, &bt).await;
                    });
                    serde_json::json!({ "ok": true, "id": id, "action": action })
                }
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "next" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::NextTrack { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => {
                    // Broadcast playback update to all subscribers
                    let bt = broadcast_tx.clone();
                    let as_ref = Arc::clone(actor_state);
                    tokio::spawn(async move {
                        broadcast_playback_update(&as_ref, &bt).await;
                    });
                    serde_json::json!({ "ok": true, "id": id, "action": action })
                }
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "prev" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::PrevTrack { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => {
                    // Broadcast playback update to all subscribers
                    let bt = broadcast_tx.clone();
                    let as_ref = Arc::clone(actor_state);
                    tokio::spawn(async move {
                        broadcast_playback_update(&as_ref, &bt).await;
                    });
                    serde_json::json!({ "ok": true, "id": id, "action": action })
                }
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "seek" => {
            let ms = cmd.get("position_ms").and_then(|v| v.as_i64()).unwrap_or(0);
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::Seek { position_ms: ms, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => {
                    // Broadcast playback update to all subscribers
                    let bt = broadcast_tx.clone();
                    let as_ref = Arc::clone(actor_state);
                    tokio::spawn(async move {
                        broadcast_playback_update(&as_ref, &bt).await;
                    });
                    serde_json::json!({ "ok": true, "id": id, "action": action })
                }
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "volume" => {
            let pct = cmd.get("percent").and_then(|v| v.as_u64()).unwrap_or(50) as u8;
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::SetVolume { percent: pct, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => {
                    // Broadcast playback update to all subscribers
                    let bt = broadcast_tx.clone();
                    let as_ref = Arc::clone(actor_state);
                    tokio::spawn(async move {
                        broadcast_playback_update(&as_ref, &bt).await;
                    });
                    serde_json::json!({ "ok": true, "id": id, "action": action })
                }
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "shuffle" => {
            let state = cmd.get("state").and_then(|v| v.as_bool()).unwrap_or(false);
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::SetShuffle { state, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "repeat" => {
            let mode = cmd.get("mode").and_then(|v| v.as_str()).unwrap_or("off").to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::SetRepeat { mode, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "transfer" => {
            let device_id = cmd.get("device_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let play = cmd.get("play").and_then(|v| v.as_bool()).unwrap_or(true);
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::TransferPlayback { device_id, play, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Device commands
        "get_devices" => {
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::GetDevices { reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(cache)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": cache }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Audio Analysis
        "get_audio_analysis" => {
            let track_id = cmd.get("track_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::GetAudioAnalysis { track_id, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Playlist Editing
        "remove_tracks_from_playlist" => {
            let playlist_id = cmd.get("playlist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let track_uris = cmd.get("track_uris")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::RemoveTracksFromPlaylist { playlist_id, track_uris, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "reorder_playlist_tracks" => {
            let playlist_id = cmd.get("playlist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let range_start = cmd.get("range_start").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let insert_before = cmd.get("insert_before").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let range_length = cmd.get("range_length").and_then(|v| v.as_u64()).map(|v| v as u32);
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::ReorderPlaylistTracks { playlist_id, range_start, insert_before, range_length, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Follow/Unfollow
        "follow_artist" => {
            let artist_id = cmd.get("artist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::FollowArtist { artist_id, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "unfollow_artist" => {
            let artist_id = cmd.get("artist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::UnfollowArtist { artist_id, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "follow_playlist" => {
            let playlist_id = cmd.get("playlist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::FollowPlaylist { playlist_id, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "unfollow_playlist" => {
            let playlist_id = cmd.get("playlist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::UnfollowPlaylist { playlist_id, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(())) => serde_json::json!({ "ok": true, "id": id, "action": action }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "check_is_following_artists" => {
            let artist_ids = cmd.get("artist_ids")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::CheckIsFollowingArtists { artist_ids, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        "check_is_following_playlist" => {
            let playlist_id = cmd.get("playlist_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let user_ids = cmd.get("user_ids")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::CheckIsFollowingPlaylist { playlist_id, user_ids, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Featured Playlists
        "get_featured_playlists" => {
            let limit = cmd.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as u32;
            let offset = cmd.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::GetFeaturedPlaylists { limit, offset, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Check Liked Songs
        "check_liked_songs" => {
            let track_ids = cmd.get("track_ids")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::CheckLikedSongs { track_ids, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Get Lyrics
        "get_lyrics" => {
            let track_id = cmd.get("track_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let (reply_tx, reply_rx) = oneshot::channel();
            actor.handle(crate::actors::spotify::GetLyrics { track_id, reply: reply_tx });
            match reply_rx.await {
                Ok(Ok(data)) => serde_json::json!({ "ok": true, "id": id, "action": action, "data": data }),
                Ok(Err(e)) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": e }),
                Err(_) => serde_json::json!({ "ok": false, "id": id, "action": action, "error": "timeout" }),
            }
        }
        
        // Unknown action
        _ => {
            serde_json::json!({
                "ok": false,
                "id": id,
                "error": format!("Unknown action: {}", action),
                "action": action
            })
        }
    }
}

/// Broadcast playback state to all subscribed clients.
async fn broadcast_playback_update(
    actor_state: &Arc<tokio::sync::Mutex<SpotifyActor>>,
    broadcast_tx: &PlaybackBroadcast,
) {
    let mut actor = actor_state.lock().await;
    let (reply_tx, reply_rx) = oneshot::channel();
    actor.handle(crate::actors::spotify::GetPlayback { reply: reply_tx });
    drop(actor); // Release lock before await
    
    if let Ok(Ok(cache)) = reply_rx.await {
        let event = serde_json::json!({
            "type": "playback_update",
            "data": cache
        });
        broadcast_tx.send(event.to_string()).ok();
    }
}
