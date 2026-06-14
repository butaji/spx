pub mod auth;
pub mod client;
pub mod device;
pub mod token;

use std::path::PathBuf;

use anyhow::{Context, Result};
use librespot_core::session::Session;
use rspotify::clients::BaseClient;

pub use auth::{get_creds, AuthConfig};
pub use client::Spotify;

pub fn client_id() -> Result<String> {
    if let Ok(id) = std::env::var("SPOTIFY_CLIENT_ID") {
        if !id.is_empty() {
            return Ok(id);
        }
    }
    if let Ok(id) = std::env::var("VITE_SPOTIFY_CLIENT_ID") {
        if !id.is_empty() {
            return Ok(id);
        }
    }

    // Try to load from a bundled config file in a packaged macOS app.
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(contents_dir) = exe_path.parent().and_then(|p| p.parent()) {
            let path = contents_dir.join("Resources/spx_client_id.txt");
            if let Ok(id) = std::fs::read_to_string(&path) {
                let id = id.trim();
                if !id.is_empty() {
                    return Ok(id.to_string());
                }
            }
        }
        if let Some(mac_dir) = exe_path.parent() {
            let path = mac_dir.join("Resources/spx_client_id.txt");
            if let Ok(id) = std::fs::read_to_string(&path) {
                let id = id.trim();
                if !id.is_empty() {
                    return Ok(id.to_string());
                }
            }
        }
    }

    anyhow::bail!("SPOTIFY_CLIENT_ID must be set")
}

pub fn cache_dir() -> Result<PathBuf> {
    let base = dirs::cache_dir().context("system cache directory not found")?;
    Ok(base.join("spx"))
}

pub fn auth_config() -> Result<AuthConfig> {
    AuthConfig::new(cache_dir()?, client_id()?)
}

pub async fn new_session(reauth: bool) -> Result<Session> {
    let auth_config = auth_config().context("auth config")?;
    let creds = get_creds(&auth_config, reauth, true).context("get credentials")?;

    let session = auth_config.session();
    session
        .connect(creds, false)
        .await
        .context("failed to create librespot session")?;

    Ok(session)
}

pub async fn new_spotify_client(reauth: bool) -> Result<Spotify> {
    let session = new_session(reauth).await.context("create session")?;
    let spotify = Spotify::new();
    spotify.set_session(session).await;

    // Force an initial token fetch so downstream calls can rely on it.
    if let Err(err) = spotify.refetch_token().await {
        tracing::warn!("Initial token prefetch failed: {err}");
    }

    Ok(spotify)
}
