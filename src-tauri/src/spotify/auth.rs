use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};

#[derive(Debug)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Instant,
}

pub struct PkceAuth {
    client_id: String,
    redirect_uri: String,
    verifier: String,
    state: String,
}

impl PkceAuth {
    pub fn new(client_id: String, redirect_uri: String) -> Self {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let verifier = URL_SAFE_NO_PAD.encode(&bytes);

        let mut state_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut state_bytes);
        let state = URL_SAFE_NO_PAD.encode(&state_bytes);

        Self {
            client_id,
            redirect_uri,
            verifier,
            state,
        }
    }

    pub fn get_auth_url(&self) -> String {
        let challenge = self.challenge();
        let scope = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-read-private user-read-email";
        format!(
            "https://accounts.spotify.com/authorize?response_type=code\
             &client_id={}\
             &scope={}\
             &redirect_uri={}\
             &code_challenge_method=S256\
             &code_challenge={}\
             &state={}",
            urlencoding::encode(&self.client_id),
            urlencoding::encode(scope),
            urlencoding::encode(&self.redirect_uri),
            challenge,
            urlencoding::encode(&self.state)
        )
    }

    pub fn get_state(&self) -> &str {
        &self.state
    }

    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    pub async fn exchange_code(
        &self,
        code: String,
        state: String,
    ) -> Result<TokenResponse, String> {
        if state != self.state {
            return Err("State mismatch - possible CSRF attack".to_string());
        }

        let client = reqwest::Client::new();
        let params = [
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &self.redirect_uri),
            ("client_id", &self.client_id),
            ("code_verifier", &self.verifier),
        ];
        let res = client
            .post("https://accounts.spotify.com/api/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = res.status();
        if !status.is_success() {
            let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            if let (Some(error), Some(desc)) = (
                json.get("error").and_then(|v| v.as_str()),
                json.get("error_description").and_then(|v| v.as_str()),
            ) {
                return Err(format!("{}: {}", error, desc));
            }
            return Err(format!("HTTP error: {}", status));
        }

        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

        if let Some(error) = json.get("error").and_then(|v| v.as_str()) {
            let desc = json
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return Err(format!("{}: {}", error, desc));
        }

        let access_token = json["access_token"]
            .as_str()
            .ok_or("No access_token in response")?
            .to_string();

        let refresh_token = json["refresh_token"].as_str().map(String::from);

        let expires_in = json["expires_in"]
            .as_i64()
            .ok_or("No expires_in in response")?;
        let expires_at = Instant::now() + Duration::from_secs(expires_in as u64);

        Ok(TokenResponse {
            access_token,
            refresh_token,
            expires_at,
        })
    }

    fn challenge(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.verifier.as_bytes());
        let result = hasher.finalize();
        URL_SAFE_NO_PAD.encode(result)
    }
}
