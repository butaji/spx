// Spotify authentication using librespot OAuth.
// Adapted from spotify-player (MIT license, Copyright (c) 2022 Thang Pham).

use std::path::PathBuf;

use anyhow::{Context, Result};
use librespot_core::{
    authentication::Credentials,
    cache::Cache,
    config::SessionConfig,
    Session,
};
use librespot_oauth::OAuthClientBuilder;


// Scopes required for SPX to function.
pub const OAUTH_SCOPES: &[&str] = &[
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "app-remote-control",
    "streaming",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-follow-read",
    "user-read-recently-played",
    "user-top-read",
    "user-library-modify",
    "user-library-read",
    "user-read-private",
];

#[derive(Clone)]
pub struct AuthConfig {
    pub cache: Cache,
    pub session_config: SessionConfig,
    pub login_redirect_uri: String,
    pub client_id: String,
}

impl AuthConfig {
    pub fn new(cache_dir: PathBuf, client_id: String) -> Result<Self> {
        let cache = Cache::new(Some(cache_dir), None, None, None)
            .context("create librespot cache")?;

        Ok(Self {
            cache,
            session_config: SessionConfig::default(),
            login_redirect_uri: "http://127.0.0.1:1422/callback".to_string(),
            client_id,
        })
    }

    pub fn session(&self) -> Session {
        Session::new(self.session_config.clone(), Some(self.cache.clone()))
    }
}

/// Obtain Spotify credentials. If no cached credentials exist and `reauth` is true,
/// open the browser and perform OAuth.
pub fn get_creds(auth_config: &AuthConfig, reauth: bool, use_cached: bool) -> Result<Credentials> {
    let creds = if use_cached {
        auth_config.cache.credentials()
    } else {
        None
    };

    Ok(match creds {
        None => {
            let msg = "No cached credentials found, please authenticate the application first.";
            if reauth {
                tracing::info!("{msg}");

                let oauth_client = OAuthClientBuilder::new(
                    &auth_config.client_id,
                    &auth_config.login_redirect_uri,
                    OAUTH_SCOPES.to_vec(),
                )
                .open_in_browser()
                .build()
                .context("build OAuth client")?;
                let token = oauth_client
                    .get_access_token()
                    .context("get OAuth access token")?;
                Credentials::with_access_token(token.access_token)
            } else {
                anyhow::bail!(msg);
            }
        }
        Some(creds) => {
            tracing::info!("Using cached librespot credentials");
            creds
        }
    })
}
