use librespot_core::{
    session::Session,
    config::SessionConfig,
    authentication::Credentials,
    cache::Cache,
};
use librespot_protocol::authentication::AuthenticationType;
use tracing::{info, error};

pub struct SpotifyConnectClient {
    pub session: Session,
}

impl SpotifyConnectClient {
    /// Create a new Spotify Connect client using an access token
    pub async fn new(access_token: &str, username: &str) -> Result<Self, String> {
        info!("Creating librespot session for user: {}", username);

        // Create credentials with access token
        let credentials = Credentials {
            username: username.to_string(),
            auth_type: AuthenticationType::AUTHENTICATION_SPOTIFY_TOKEN,
            auth_data: access_token.as_bytes().to_vec(),
        };

        let session_config = SessionConfig::default();
        let cache = Cache::new(
            None::<&str>, None::<&str>, None::<&str>, None::<u64>
        )
        .map_err(|e| format!("Cache init failed: {}", e))?;

        // Connect to Spotify
        match Session::connect(session_config, credentials, Some(cache), false).await {
            Ok((session, _reusable_creds)) => {
                info!("librespot session created successfully");
                Ok(Self { session })
            }
            Err(e) => {
                error!("Failed to create librespot session: {}", e);
                Err(format!("Session connection failed: {}", e))
            }
        }
    }

    /// Get the canonical username from the session
    pub fn username(&self) -> String {
        self.session.username()
    }
}

/// Test the connection
pub async fn test_librespot(access_token: &str, username: &str) -> Result<String, String> {
    let client = SpotifyConnectClient::new(access_token, username).await?;
    Ok(format!("Connected as: {}", client.username()))
}