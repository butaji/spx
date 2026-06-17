//! Event Bus for reactive event-driven architecture.
//!
//! This module provides a publish-subscribe event system using tokio channels.
//! All backend events are published here, allowing the frontend to subscribe
//! to real-time updates.
//!
//! # Architecture
//!
//! ```text
//! Command ──publish──► EventBus ──broadcast──► Subscribers
//!                    │
//!                    └── Event History (configurable)
//! ```
//!
//! # Event Categories
//!
//! - `DeviceEvent` - Device discovery, connection, disconnection
//! - `AuthEvent` - Authentication state changes
//! - `PlaybackEvent` - Playback state updates
//! - `SystemEvent` - System-level notifications

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, info, warn};

/// Event types that flow through the event bus.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SpxEvent {
    // Device events
    DeviceDiscovered(DeviceInfo),
    DeviceConnected(DeviceInfo),
    DeviceDisconnected(String), // device_id
    DeviceWakeStarted(String),   // device_id
    DeviceWakeCompleted(String), // device_id
    DeviceWakeFailed { id: String, error: String },

    // Auth events
    AuthStarted,
    AuthCompleted { username: String },
    AuthFailed { error: String },
    TokenRefreshStarted,
    TokenRefreshCompleted,
    TokenRefreshFailed { error: String },
    LogoutCompleted,

    // Cast authentication events
    CastAuthStarted { device_id: String },
    CastAuthProgress { device_id: String, step: String },
    CastAuthCompleted { device_id: String },
    CastAuthFailed { device_id: String, error: String },

    // Local Connect events
    LocalConnectStarted,
    LocalConnectCompleted { device_id: String },
    LocalConnectFailed { error: String },

    // System events
    NowPlayingUpdated { track: Option<String>, artist: Option<String> },
    NowPlayingCleared,
    MediaKeyRegistered,
    DiagnosticsUpdated,
    NetworkDiagCompleted { result: String },

    // Error events
    Error { code: String, message: String },
}

/// Device information for device-related events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub ip: Option<String>,
    pub port: Option<u16>,
}

/// The event bus singleton.
pub struct EventBus {
    sender: broadcast::Sender<SpxEvent>,
    history: Arc<RwLock<Vec<SpxEvent>>>,
    max_history: usize,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new(100)
    }
}

impl EventBus {
    /// Create a new event bus with the specified history size.
    pub fn new(max_history: usize) -> Self {
        let (sender, _) = broadcast::channel(256);
        Self {
            sender,
            history: Arc::new(RwLock::new(Vec::with_capacity(max_history))),
            max_history,
        }
    }

    /// Get a subscriber for receiving events.
    pub fn subscriber(&self) -> EventSubscriber {
        EventSubscriber {
            receiver: self.sender.subscribe(),
        }
    }

    /// Publish an event to all subscribers.
    pub async fn publish(&self, event: SpxEvent) {
        // Log event at appropriate level
        match &event {
            SpxEvent::Error { code, message } => {
                warn!("[Event] Error {}: {}", code, message);
            }
            SpxEvent::DeviceDiscovered(d) => {
                debug!("[Event] Device discovered: {}", d.name);
            }
            SpxEvent::DeviceConnected(d) => {
                info!("[Event] Device connected: {}", d.name);
            }
            SpxEvent::AuthCompleted { username } => {
                info!("[Event] Auth completed for: {}", username);
            }
            _ => {
                debug!("[Event] {:?}", event);
            }
        }

        // Store in history
        {
            let mut history = self.history.write().await;
            if history.len() >= self.max_history {
                history.remove(0);
            }
            history.push(event.clone());
        }

        // Broadcast to subscribers
        if let Err(e) = self.sender.send(event) {
            debug!("No subscribers for event: {:?}", e);
        }
    }

    /// Get recent event history.
    pub async fn history(&self, limit: usize) -> Vec<SpxEvent> {
        let history = self.history.read().await;
        let start = history.len().saturating_sub(limit);
        history[start..].to_vec()
    }

    /// Get events filtered by type.
    pub async fn filter<F>(&self, predicate: F) -> Vec<SpxEvent>
    where
        F: Fn(&SpxEvent) -> bool,
    {
        let history = self.history.read().await;
        history.iter().filter(|e| predicate(e)).cloned().collect()
    }
}

/// A subscriber that receives events from the event bus.
#[derive(Debug)]
pub struct EventSubscriber {
    receiver: broadcast::Receiver<SpxEvent>,
}

impl EventSubscriber {
    /// Receive the next event, waiting if necessary.
    pub async fn recv(&mut self) -> Option<SpxEvent> {
        self.receiver.recv().await.ok()
    }

    /// Try to receive an event without waiting.
    pub fn try_recv(&mut self) -> Option<SpxEvent> {
        self.receiver.try_recv().ok()
    }
}

// ─── Global Event Bus Singleton ─────────────────────────────────────────────────

use once_cell::sync::Lazy;
use tokio::sync::RwLock as AsyncRwLock;

/// The global event bus instance.
pub static EVENT_BUS: Lazy<AsyncRwLock<EventBus>> = Lazy::new(|| AsyncRwLock::new(EventBus::default()));

/// Publish an event to the global event bus.
pub async fn publish(event: SpxEvent) {
    EVENT_BUS.read().await.publish(event).await;
}

/// Convenience functions for common events.
pub mod helpers {
    use super::*;

    pub async fn device_discovered(info: DeviceInfo) {
        publish(SpxEvent::DeviceDiscovered(info)).await;
    }

    pub async fn device_connected(info: DeviceInfo) {
        publish(SpxEvent::DeviceConnected(info)).await;
    }

    pub async fn device_disconnected(id: String) {
        publish(SpxEvent::DeviceDisconnected(id)).await;
    }

    pub async fn auth_started() {
        publish(SpxEvent::AuthStarted).await;
    }

    pub async fn auth_completed(username: String) {
        publish(SpxEvent::AuthCompleted { username }).await;
    }

    pub async fn auth_failed(error: String) {
        publish(SpxEvent::AuthFailed { error }).await;
    }

    pub async fn cast_auth_started(device_id: String) {
        publish(SpxEvent::CastAuthStarted { device_id }).await;
    }

    pub async fn cast_auth_progress(device_id: String, step: String) {
        publish(SpxEvent::CastAuthProgress { device_id, step }).await;
    }

    pub async fn cast_auth_completed(device_id: String) {
        publish(SpxEvent::CastAuthCompleted { device_id }).await;
    }

    pub async fn cast_auth_failed(device_id: String, error: String) {
        publish(SpxEvent::CastAuthFailed { device_id, error }).await;
    }

    pub async fn local_connect_started() {
        publish(SpxEvent::LocalConnectStarted).await;
    }

    pub async fn local_connect_completed(device_id: String) {
        publish(SpxEvent::LocalConnectCompleted { device_id }).await;
    }

    pub async fn local_connect_failed(error: String) {
        publish(SpxEvent::LocalConnectFailed { error }).await;
    }

    pub async fn now_playing_updated(track: Option<String>, artist: Option<String>) {
        publish(SpxEvent::NowPlayingUpdated { track, artist }).await;
    }

    pub async fn error(code: &str, message: &str) {
        publish(SpxEvent::Error {
            code: code.to_string(),
            message: message.to_string(),
        }).await;
    }
}
