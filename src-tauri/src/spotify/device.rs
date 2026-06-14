// Device discovery and playback transfer helpers.
// Adapted from spotify-player (MIT license, Copyright (c) 2022 Thang Pham).

use std::borrow::Cow;

use anyhow::{Context, Result};
use librespot_core::session::Session;
use rspotify::clients::OAuthClient;

use super::client::Spotify;

/// A device that can play Spotify audio.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub is_active: bool,
}

impl Device {
    pub fn from_rspotify(d: rspotify::model::Device) -> Option<Self> {
        Some(Self {
            id: d.id?,
            name: d.name,
            is_active: d.is_active,
        })
    }
}

/// Get Spotify Connect devices visible to the current user.
pub async fn available_devices(client: &Spotify) -> Result<Vec<Device>> {
    let mut devices: Vec<Device> = client
        .device()
        .await?
        .into_iter()
        .filter_map(Device::from_rspotify)
        .collect();

    // When librespot streaming is active, append the local device so it is always selectable.
    if let Some(session) = client.session().await {
        let local = Device {
            id: session.device_id().to_string(),
            name: "This device".to_string(),
            is_active: false,
        };
        if !devices.iter().any(|d| d.id == local.id) {
            devices.push(local);
        }
    }

    Ok(devices)
}

/// Find an available device and return its ID.
///
/// * Prefers the currently active device.
/// * Falls back to `preferred_device_name` (case-insensitive).
/// * Uses the first available device otherwise.
pub async fn find_available_device(
    client: &Spotify,
    preferred_device_name: Option<&str>,
) -> Result<Option<String>> {
    let devices = available_devices(client).await?;
    tracing::info!("Available devices: {devices:?}");

    if devices.is_empty() {
        return Ok(None);
    }

    // Prefer the active device.
    if let Some(d) = devices.iter().find(|d| d.is_active) {
        return Ok(Some(d.id.clone()));
    }

    // Fall back to the configured default device name.
    if let Some(preferred) = preferred_device_name {
        let preferred_low = preferred.to_lowercase();
        if let Some(d) = devices.iter().find(|d| d.name.to_lowercase() == preferred_low) {
            return Ok(Some(d.id.clone()));
        }
    }

    Ok(Some(devices.first().context("no devices")?.id.clone()))
}

/// Ensure playback is available by transferring to an available device if needed.
///
/// Returns `true` if a transfer was attempted and succeeded.
pub async fn initialize_playback(
    client: &Spotify,
    preferred_device_name: Option<&str>,
    force_play: bool,
) -> Result<Option<String>> {
    let delay = std::time::Duration::from_secs(1);

    for attempt in 0..5 {
        tokio::time::sleep(delay).await;

        let id = match find_available_device(client, preferred_device_name).await {
            Ok(Some(id)) => Some(Cow::Owned(id)),
            Ok(None) => None,
            Err(err) => {
                tracing::warn!("Failed to find an available device: {err:#}");
                None
            }
        };

        if let Some(id) = id {
            tracing::info!("Trying to connect to device (id={id}, attempt={attempt})");
            match client.transfer_playback(&id, Some(force_play)).await {
                Ok(()) => {
                    tracing::info!("Connection succeeded (device_id={id})");
                    return Ok(Some(id.into_owned()));
                }
                Err(err) => {
                    tracing::warn!("Connection failed (device_id={id}): {err:#}");
                }
            }
        }
    }

    anyhow::bail!("No available Spotify Connect device found after retries")
}

/// Return the librespot local device ID if a session exists.
pub async fn local_device_id(session: Option<&Session>) -> Option<String> {
    session.map(|s| s.device_id().to_string())
}
