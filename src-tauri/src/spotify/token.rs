// Convert librespot login5 tokens into rspotify tokens.
// Adapted from spotify-player (MIT license, Copyright (c) 2022 Thang Pham).

use std::collections::HashSet;

use anyhow::{Context, Result};
use librespot_core::session::Session;

const TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

pub async fn get_token_rspotify(session: &Session) -> Result<rspotify::Token> {
    tracing::info!("Getting a new authentication token via librespot login5...");

    let auth_data = session.auth_data();
    if auth_data.is_empty() {
        anyhow::bail!("Session has no stored credentials for login5 token acquisition");
    }

    let fut = session.login5().auth_token();
    let token = match tokio::time::timeout(TIMEOUT, fut).await {
        Ok(Ok(token)) => token,
        Ok(Err(err)) => anyhow::bail!("failed to get the token: {err:?}"),
        Err(_) => {
            if !session.is_invalid() {
                session.shutdown();
            }
            anyhow::bail!("timeout when getting the token");
        }
    };

    let expires_in = chrono::Duration::from_std(token.expires_in)
        .context("convert token expiry")?;
    let expires_at = chrono::Utc::now() + expires_in;

    Ok(rspotify::Token {
        access_token: token.access_token,
        expires_in,
        expires_at: Some(expires_at),
        scopes: HashSet::new(),
        refresh_token: None,
    })
}
