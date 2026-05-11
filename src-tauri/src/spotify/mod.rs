pub mod auth;
pub mod mock;

use auth::PkceAuth;
use reqwest::Client;
use serde_json::Value;

pub struct SpotifyClient {
    auth: PkceAuth,
    http: Client,
    access_token: Option<String>,
}

impl SpotifyClient {
    pub fn new(client_id: String, redirect_uri: String) -> Self {
        Self {
            auth: PkceAuth::new(client_id, redirect_uri),
            http: Client::new(),
            access_token: None,
        }
    }

    pub fn get_auth_url(&self) -> String {
        self.auth.get_auth_url()
    }

    pub async fn exchange_code(&mut self, code: String, state: String) -> Result<auth::TokenResponse, String> {
        let token = self.auth.exchange_code(code, state).await?;
        self.access_token = Some(token.access_token.clone());
        Ok(token)
    }

    pub async fn refresh_access_token(&mut self, refresh_token: &str) -> Result<(), String> {
        let client_id = self.auth.client_id();
        let client = reqwest::Client::new();
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
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

        let access_token = json["access_token"]
            .as_str()
            .ok_or("No access_token in response")?
            .to_string();

        self.access_token = Some(access_token);
        Ok(())
    }

    fn token(&self) -> Result<String, String> {
        self.access_token.clone().ok_or_else(|| "Not authenticated".to_string())
    }

    async fn check_status(res: reqwest::Response) -> Result<reqwest::Response, String> {
        let status = res.status();
        if status.is_success() {
            return Ok(res);
        }
        let code = status.as_u16();
        let body = res.text().await.unwrap_or_default();
        match code {
            401 => Err("Authentication expired".to_string()),
            429 => Err("Rate limited - try again later".to_string()),
            500..=599 => Err("Spotify server error".to_string()),
            _ => Err(if body.is_empty() {
                format!("Request failed with status {}", code)
            } else {
                body
            }),
        }
    }

    pub async fn get_playback_state(&self) -> Result<Value, String> {
        let res = self.http
            .get("https://api.spotify.com/v1/me/player")
            .bearer_auth(self.token()?)
            .send().await.map_err(|e| e.to_string())?;
        if res.status().as_u16() == 204 {
            return Ok(serde_json::json!({"is_playing": false}));
        }
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn play(&self) -> Result<(), String> {
        let res = self.http.put("https://api.spotify.com/v1/me/player/play")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn pause(&self) -> Result<(), String> {
        let res = self.http.put("https://api.spotify.com/v1/me/player/pause")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn next(&self) -> Result<(), String> {
        let res = self.http.post("https://api.spotify.com/v1/me/player/next")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn previous(&self) -> Result<(), String> {
        let res = self.http.post("https://api.spotify.com/v1/me/player/previous")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn seek(&self, position_ms: u32) -> Result<(), String> {
        if position_ms > u32::MAX {
            return Err("position_ms out of valid range".to_string());
        }
        let res = self.http.put("https://api.spotify.com/v1/me/player/seek")
            .query(&[("position_ms", &position_ms.to_string())])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn set_volume(&self, volume_percent: u8) -> Result<(), String> {
        if volume_percent > 100 {
            return Err("volume_percent must be 0-100".to_string());
        }
        let res = self.http.put("https://api.spotify.com/v1/me/player/volume")
            .query(&[("volume_percent", &volume_percent.to_string())])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn set_shuffle(&self, state: bool) -> Result<(), String> {
        let res = self.http.put("https://api.spotify.com/v1/me/player/shuffle")
            .query(&[("state", &state.to_string())])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn set_repeat(&self, state: &str) -> Result<(), String> {
        let res = self.http.put("https://api.spotify.com/v1/me/player/repeat")
            .query(&[("state", state)])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn get_queue(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/me/player/queue")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_devices(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/me/player/devices")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn transfer_playback(&self, device_id: &str) -> Result<(), String> {
        let body = serde_json::json!({ "device_ids": [device_id], "play": true });
        let res = self.http.put("https://api.spotify.com/v1/me/player")
            .bearer_auth(self.token()?).json(&body).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn search(&self, query: &str) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/search")
            .query(&[("q", query), ("type", "track,album,artist,playlist"), ("limit", "20")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_user_playlists(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/me/playlists")
            .query(&[("limit", "50")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_playlist_tracks(&self, playlist_id: &str) -> Result<Value, String> {
        let res = self.http.get(&format!("https://api.spotify.com/v1/playlists/{}/tracks", playlist_id))
            .query(&[("limit", "50")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_playlist(&self, playlist_id: &str) -> Result<Value, String> {
        let res = self.http.get(&format!("https://api.spotify.com/v1/playlists/{}", playlist_id))
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_saved_tracks(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/me/tracks")
            .query(&[("limit", "50")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_saved_albums(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/me/albums")
            .query(&[("limit", "50")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_user_profile(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/me")
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_featured_playlists(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/browse/featured-playlists")
            .query(&[("limit", "20")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_categories(&self) -> Result<Value, String> {
        let res = self.http.get("https://api.spotify.com/v1/browse/categories")
            .query(&[("limit", "20")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_album(&self, album_id: &str) -> Result<Value, String> {
        let res = self.http.get(&format!("https://api.spotify.com/v1/albums/{}", album_id))
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_artist(&self, artist_id: &str) -> Result<Value, String> {
        let res = self.http.get(&format!("https://api.spotify.com/v1/artists/{}", artist_id))
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn get_artist_top_tracks(&self, artist_id: &str) -> Result<Value, String> {
        let res = self.http.get(&format!("https://api.spotify.com/v1/artists/{}/top-tracks", artist_id))
            .query(&[("market", "US")])
            .bearer_auth(self.token()?).send().await.map_err(|e| e.to_string())?;
        let res = Self::check_status(res).await?;
        res.json().await.map_err(|e| e.to_string())
    }

    pub async fn play_context(&self, context_uri: &str, offset_uri: Option<&str>) -> Result<(), String> {
        let mut body = serde_json::json!({ "context_uri": context_uri });
        if let Some(uri) = offset_uri {
            body["offset"] = serde_json::json!({ "uri": uri });
        }
        let res = self.http.put("https://api.spotify.com/v1/me/player/play")
            .bearer_auth(self.token()?).json(&body).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }

    pub async fn play_uris(&self, uris: Vec<String>, offset: Option<u32>) -> Result<(), String> {
        let mut body = serde_json::json!({ "uris": uris });
        if let Some(idx) = offset {
            body["offset"] = serde_json::json!({ "position": idx });
        }
        let res = self.http.put("https://api.spotify.com/v1/me/player/play")
            .bearer_auth(self.token()?).json(&body).send().await.map_err(|e| e.to_string())?;
        Self::check_status(res).await?;
        Ok(())
    }
}
