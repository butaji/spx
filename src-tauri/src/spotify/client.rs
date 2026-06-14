// Custom rspotify client backed by a librespot session.
// Adapted from spotify-player (MIT license, Copyright (c) 2022 Thang Pham).

use std::{fmt, sync::Arc};

use librespot_core::session::Session;
use rspotify::{
    clients::{BaseClient, OAuthClient},
    http::HttpClient,
    sync::Mutex,
    ClientResult, Config, Credentials, OAuth, Token,
};

use super::token;

#[derive(Clone, Default)]
pub struct Spotify {
    creds: Credentials,
    oauth: OAuth,
    config: Config,
    token: Arc<Mutex<Option<Token>>>,
    http: HttpClient,
    session: Arc<tokio::sync::Mutex<Option<Session>>>,
}

#[allow(clippy::missing_fields_in_debug)]
impl fmt::Debug for Spotify {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Spotify")
            .field("creds", &self.creds)
            .field("oauth", &self.oauth)
            .field("config", &self.config)
            .field("token", &self.token)
            .finish()
    }
}

impl Spotify {
    pub fn new() -> Self {
        Self {
            creds: Credentials::default(),
            oauth: OAuth::default(),
            config: Config {
                token_refreshing: true,
                ..Default::default()
            },
            token: Arc::new(Mutex::new(None)),
            http: HttpClient::default(),
            session: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    pub async fn set_session(&self, session: Session) {
        *self.session.lock().await = Some(session);
    }

    pub async fn session(&self) -> Option<Session> {
        self.session.lock().await.clone()
    }

    pub async fn is_session_invalid(&self) -> bool {
        match self.session.lock().await.as_ref() {
            Some(s) => s.is_invalid(),
            None => true,
        }
    }

    pub async fn set_token(&self, token: Token) {
        if let Ok(mut guard) = self.token.lock().await {
            *guard = Some(token);
        }
    }

    pub fn set_token_refreshing(&mut self, enabled: bool) {
        self.config.token_refreshing = enabled;
    }
}

#[async_trait::async_trait]
impl BaseClient for Spotify {
    fn get_http(&self) -> &HttpClient {
        &self.http
    }

    fn get_token(&self) -> Arc<Mutex<Option<Token>>> {
        Arc::clone(&self.token)
    }

    fn get_creds(&self) -> &Credentials {
        &self.creds
    }

    fn get_config(&self) -> &Config {
        &self.config
    }

    async fn refetch_token(&self) -> ClientResult<Option<Token>> {
        let session = match self.session().await {
            Some(s) => s,
            None => {
                tracing::error!("Failed to refetch token: no librespot session");
                // Return current token if available, or None
                if let Ok(guard) = self.get_token().lock().await {
                    return Ok(guard.clone());
                }
                return Ok(None);
            }
        };

        if session.is_invalid() {
            tracing::error!("Failed to get a new token: invalid session");
            if let Ok(guard) = self.get_token().lock().await {
                return Ok(guard.clone());
            }
            return Ok(None);
        }

        match token::get_token_rspotify(&session).await {
            Ok(token) => Ok(Some(token)),
            Err(err) => {
                tracing::error!("Failed to get a new token: {err:#}");
                if let Ok(guard) = self.get_token().lock().await {
                    return Ok(guard.clone());
                }
                Ok(None)
            }
        }
    }
}

#[async_trait::async_trait]
impl OAuthClient for Spotify {
    fn get_oauth(&self) -> &OAuth {
        panic!("`OAuthClient::get_oauth` should never be called!")
    }

    async fn request_token(&self, _code: &str) -> ClientResult<()> {
        panic!("`OAuthClient::request_token` should never be called!")
    }
}
