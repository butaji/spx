//! Spotify Web Player access-token fetcher.
//!
//! Google Cast and some Sonos devices require a "web-player" access token to
//! activate the Spotify receiver. SPX's normal PKCE OAuth token is a
//! *web-api* token and is rejected by those devices. This module implements
//! the cookie-based Web Player token exchange used by spotcast /
//! spotify-webplayer-token.
//!
//! Requires the `SPOTIFY_SP_DC` environment variable (or the `sp_dc` argument)
//! which is the `sp_dc` cookie from an authenticated open.spotify.com session.
//!
//! Algorithm reference:
//! https://github.com/mirrorfm/spotify-webplayer-token

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const SECRETS_URL: &str = "https://raw.githubusercontent.com/xyloflake/spot-secrets-go/main/secrets/secretDict.json";
/// Refresh token 5 minutes before expiration to avoid edge-case failures.
const TOKEN_REFRESH_BUFFER_SECS: u64 = 300;

/// Web Player token response from Spotify.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebPlayerToken {
    pub client_id: String,
    pub access_token: String,
    pub access_token_expiration_timestamp_ms: u64,
    pub is_anonymous: bool,
}

impl WebPlayerToken {
    /// Token lifetime in seconds (best-effort).
    pub fn expires_in_secs(&self) -> u64 {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        self.access_token_expiration_timestamp_ms
            .saturating_sub(now_ms)
            / 1000
    }
}

/// Cached token state with sp_dc for cache invalidation.
#[derive(Clone)]
struct CachedToken {
    token: WebPlayerToken,
    sp_dc_hash: u64, // Hash of sp_dc to detect cookie changes
}

/// Module-level token cache (shared across all callers).
static TOKEN_CACHE: std::sync::LazyLock<Arc<RwLock<Option<CachedToken>>>> =
    std::sync::LazyLock::new(|| Arc::new(RwLock::new(None)));

/// Simple hash for cache invalidation (not cryptographic, just for quick comparison).
fn hash_sp_dc(sp_dc: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut s = DefaultHasher::new();
    sp_dc.hash(&mut s);
    s.finish()
}

/// Fetch a web-player token using the `sp_dc` cookie (with caching).
///
/// `sp_dc` can be supplied directly. If `None`, the function falls back to the
/// `SPOTIFY_SP_DC` environment variable.
///
/// Returns a cached token if still valid (>5 min before expiration).
/// Automatically invalidates cache if the `sp_dc` cookie changes.
pub async fn get_web_player_token(sp_dc: Option<&str>) -> Result<WebPlayerToken, String> {
    let sp_dc = sp_dc
        .map(|s| s.trim().to_string())
        .or_else(|| std::env::var("SPOTIFY_SP_DC").ok())
        .filter(|s| !s.is_empty())
        .ok_or("sp_dc cookie is required. Set SPOTIFY_SP_DC or pass it as an argument.")?;

    let sp_dc_hash = hash_sp_dc(&sp_dc);

    // Check cache first
    {
        let cache = TOKEN_CACHE.read().await;
        if let Some(cached) = cache.as_ref() {
            if cached.sp_dc_hash == sp_dc_hash {
                let remaining = cached.token.expires_in_secs();
                if remaining > TOKEN_REFRESH_BUFFER_SECS {
                    debug!(
                        "Returning cached Web Player token ({}s remaining)",
                        remaining
                    );
                    return Ok(cached.token.clone());
                }
                debug!(
                    "Cached token expiring soon ({}s remaining), will refresh",
                    remaining
                );
            } else {
                debug!("sp_dc changed, forcing token refresh");
            }
        }
    }

    // Fetch fresh token
    info!("Fetching Web Player TOTP secrets...");
    let secrets = fetch_totp_secrets().await?;

    let (version, cipher) = latest_cipher(&secrets)?;
    debug!("Using TOTP version {} with {} cipher digits", version, cipher.len());

    let code = generate_totp(&cipher)?;
    debug!("Generated TOTP code");

    let url = format!(
        "https://open.spotify.com/api/token?reason=transport&productType=web-player&totp={}&totpServer={}&totpVer={}",
        code, code, version
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("failed to build http client: {e}"))?;

    let response = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .header("Referer", "https://open.spotify.com/")
        .header("App-Platform", "WebPlayer")
        .header("Cookie", format!("sp_dc={}", sp_dc))
        .send()
        .await
        .map_err(|e| format!("token request failed: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("failed to read token response body: {e}"))?;

    if !status.is_success() {
        return Err(format!(
            "Spotify Web Player token request failed ({}): {}",
            status, body
        ));
    }

    let token: WebPlayerToken = serde_json::from_str(&body)
        .map_err(|e| format!("failed to parse Web Player token response: {e} (body: {body})"))?;

    if token.access_token.is_empty() {
        return Err("Spotify returned an empty Web Player access token".to_string());
    }

    // Update cache
    let cached = CachedToken {
        token: token.clone(),
        sp_dc_hash,
    };
    {
        let mut cache = TOKEN_CACHE.write().await;
        *cache = Some(cached);
    }

    println!(
        "[web-player-token] Got Web Player token (expires in {}s, anonymous={})",
        token.expires_in_secs(),
        token.is_anonymous
    );
    Ok(token)
}

/// Force-clear the token cache (e.g., after sp_dc cookie changes).
pub async fn clear_token_cache() {
    let mut cache = TOKEN_CACHE.write().await;
    *cache = None;
    debug!("Web Player token cache cleared");
}

/// Fetch the public TOTP cipher secrets dictionary.
async fn fetch_totp_secrets() -> Result<HashMap<String, Vec<i64>>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("failed to build http client: {e}"))?;

    let response = client
        .get(SECRETS_URL)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("failed to fetch TOTP secrets: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("failed to read secrets response body: {e}"))?;

    if !status.is_success() {
        return Err(format!("TOTP secrets request failed ({}): {}", status, body));
    }

    serde_json::from_str(&body)
        .map_err(|e| format!("failed to parse TOTP secrets: {e}"))
}

/// Pick the highest-version cipher from the secrets dictionary.
fn latest_cipher(secrets: &HashMap<String, Vec<i64>>) -> Result<(String, Vec<i64>), String> {
    let mut latest_ver: i64 = -1;
    let mut latest_key = String::new();

    for key in secrets.keys() {
        let ver = key
            .parse::<i64>()
            .map_err(|e| format!("invalid secret version key '{key}': {e}"))?;
        if ver > latest_ver {
            latest_ver = ver;
            latest_key.clone_from(key);
        }
    }

    if latest_ver < 0 {
        return Err("TOTP secrets dictionary is empty".to_string());
    }

    let cipher = secrets
        .get(&latest_key)
        .cloned()
        .ok_or_else(|| format!("missing cipher for version {latest_key}"))?;

    Ok((latest_key, cipher))
}

/// Generate the 6-digit TOTP code from the cipher.
fn generate_totp(cipher: &[i64]) -> Result<String, String> {
    // 1. XOR transform used by Spotify's web player.
    let transformed: Vec<i64> = cipher
        .iter()
        .enumerate()
        .map(|(t, e)| e ^ ((t as i64 % 33) + 9))
        .collect();

    // 2. Concatenate the digits into a decimal string.
    let decimal = transformed
        .iter()
        .map(|n| n.to_string())
        .collect::<String>();

    // 3. Hex-encode the UTF-8 bytes of that decimal string, then decode back to bytes.
    let hex_str = decimal
        .bytes()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    let hex_bytes = hex::decode(&hex_str)
        .map_err(|e| format!("failed to decode hex TOTP secret: {e}"))?;

    // 4. Base32 encode without padding → this is the TOTP secret.
    let secret = data_encoding::BASE32_NOPAD.encode(&hex_bytes);

    // 5. RFC 6238 TOTP with SHA-1, 30-second step, 6 digits.
    let secret_bytes = data_encoding::BASE32_NOPAD
        .decode(secret.to_uppercase().as_bytes())
        .map_err(|e| format!("failed to decode base32 TOTP secret: {e}"))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let counter = now / 30;

    type HmacSha1 = Hmac<Sha1>;
    let mut mac = HmacSha1::new_from_slice(&secret_bytes)
        .map_err(|e| format!("failed to create HMAC: {e}"))?;
    mac.update(&counter.to_be_bytes());
    let result = mac.finalize().into_bytes();

    let offset = (result[result.len() - 1] & 0x0f) as usize;
    let code = ((u32::from(result[offset]) & 0x7f) << 24
        | (u32::from(result[offset + 1])) << 16
        | (u32::from(result[offset + 2])) << 8
        | (u32::from(result[offset + 3])))
        % 1_000_000;

    Ok(format!("{:06}", code))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latest_cipher_picks_max_version() {
        let mut secrets = HashMap::new();
        secrets.insert("1".to_string(), vec![1, 2, 3]);
        secrets.insert("5".to_string(), vec![4, 5, 6]);
        secrets.insert("3".to_string(), vec![7, 8, 9]);

        let (ver, cipher) = latest_cipher(&secrets).unwrap();
        assert_eq!(ver, "5");
        assert_eq!(cipher, vec![4, 5, 6]);
    }

    #[test]
    fn test_latest_cipher_empty_fails() {
        let secrets: HashMap<String, Vec<i64>> = HashMap::new();
        assert!(latest_cipher(&secrets).is_err());
    }

    #[test]
    fn test_generate_totp_returns_six_digits() {
        // The actual code depends on current time; just verify shape.
        let cipher = vec![1, 2, 3, 4, 5];
        let code = generate_totp(&cipher).unwrap();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_web_player_token_expires_in_secs() {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let token = WebPlayerToken {
            client_id: "client".to_string(),
            access_token: "token".to_string(),
            access_token_expiration_timestamp_ms: now_ms + 3600_000,
            is_anonymous: false,
        };
        // Allow a few seconds of drift.
        assert!((token.expires_in_secs() as i64 - 3600).abs() < 5);
    }

    #[test]
    fn test_hash_sp_dc_is_deterministic() {
        let hash1 = hash_sp_dc("test_cookie_123");
        let hash2 = hash_sp_dc("test_cookie_123");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_hash_sp_dc_different_inputs() {
        let hash1 = hash_sp_dc("cookie_a");
        let hash2 = hash_sp_dc("cookie_b");
        assert_ne!(hash1, hash2);
    }

    #[tokio::test]
    async fn test_clear_token_cache() {
        clear_token_cache().await;
        // Verify cache is empty by checking internal state (would need async inspection in real scenario)
        // This test just verifies the function doesn't panic
    }

    #[tokio::test]
    #[ignore]
    async fn test_real_web_player_token_fetch() {
        let token = get_web_player_token(None).await.expect("fetch token");
        println!("client_id={} access_token={}... expires_in={}s anonymous={}",
            token.client_id,
            &token.access_token[..40],
            token.expires_in_secs(),
            token.is_anonymous
        );
        assert!(!token.access_token.is_empty());
        assert!(!token.is_anonymous);
    }
}
