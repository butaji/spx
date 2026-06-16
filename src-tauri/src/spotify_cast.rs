//! Google Cast Spotify receiver authentication.
//!
//! Implements the modern Cast auth flow used by Spotcast / pychromecast:
//! 1. Connect to the Cast device and launch Spotify app `CC32E753`.
//! 2. Send `getInfo` on the Spotify secure namespace.
//! 3. Use the returned `deviceID` + `clientID` to call
//!    `spclient.wg.spotify.com/device-auth/v1/refresh` with a Web Player token.
//! 4. Send `addUser` with the refreshed `accessToken` (`tokenType: "accesstoken"`).
//! 5. The device registers with Spotify and appears in the Web API device list.
//!
//! References:
//! - Spotcast spotify_controller.py
//! - Kopiro's reverse-engineering of the Cast protocol

use rust_cast::message_manager::CastMessagePayload;
use serde_json::json;
use std::str::FromStr;
use std::time::Duration;

fn spotify_device_id(name: &str) -> String {
    let digest = md5::compute(name.as_bytes());
    format!("{:x}", digest)
}

const SPOTIFY_APP_ID: &str = "CC32E753";
const SPOTIFY_NAMESPACE: &str = "urn:x-cast:com.spotify.chromecast.secure.v1";
const DEVICE_AUTH_URL: &str = "https://spclient.wg.spotify.com/device-auth/v1/refresh";

/// Authenticate a Google Cast device with Spotify so it appears in the Web API.
///
/// `access_token` must be a **Spotify Web Player token**. A normal Web API token
/// is rejected by the Cast receiver. SPX resolves the token in
/// `commands::resolve_cast_token` (env var or stored `sp_dc` → Web Player token).
pub fn authenticate_cast_device(
    ip: &str,
    access_token: &str,
    device_name: &str,
) -> Result<String, String> {
    println!("[cast] Starting Cast auth for {} at {}", device_name, ip);

    // rust_cast uses rustls; make sure a crypto provider is installed.
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

    // Connect to Cast device.
    println!("[cast] Connecting to {}:8009...", ip);
    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .map_err(|e| format!("Cast connect failed: {}", e))?;
    println!("[cast] TCP + TLS connected");

    // CONNECT on the connection namespace.
    println!("[cast] Sending CONNECT to receiver-0...");
    cast_device.connection.connect("receiver-0")
        .map_err(|e| format!("CONNECT failed: {}", e))?;
    println!("[cast] CONNECT sent");

    // Launch a fresh Spotify app session.
    println!("[cast] Launching Spotify app {}...", SPOTIFY_APP_ID);
    let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str(SPOTIFY_APP_ID)
        .map_err(|_| "Invalid Spotify app ID".to_string())?;
    let launched = cast_device.receiver.launch_app(&app_id)
        .map_err(|e| format!("Launch failed: {}", e))?;
    let transport_id = launched.transport_id;
    println!("[cast] Launched Spotify, transport_id={}", transport_id);

    // CONNECT to the Spotify app transport.
    println!("[cast] Sending CONNECT to app transport {}...", transport_id);
    cast_device.connection.connect(&transport_id)
        .map_err(|e| format!("CONNECT to app failed: {}", e))?;
    println!("[cast] CONNECT to app sent");

    // Give the receiver a moment to initialize.
    std::thread::sleep(Duration::from_millis(500));

    // Step 1: getInfo with local device metadata.
    let local_device_id = spotify_device_id(device_name);
    println!("[cast] Sending getInfo to {} (local device_id={})...", transport_id, local_device_id);
    let get_info_msg = json!({
        "type": "getInfo",
        "payload": {
            "remoteName": device_name,
            "deviceID": local_device_id,
            "deviceAPI_isGroup": false,
        }
    });
    cast_device.receiver.send_message(SPOTIFY_NAMESPACE, &transport_id, &get_info_msg)
        .map_err(|e| format!("Failed to send getInfo: {}", e))?;
    println!("[cast] getInfo sent; waiting for response...");

    let info_response = wait_for_message(&cast_device, SPOTIFY_NAMESPACE, "getInfoResponse", 15)
        .map_err(|e| format!("getInfoResponse timeout: {}", e))?;
    println!("[cast] Received getInfoResponse: {}", info_response);

    let client_id = parse_get_info_response(&info_response)?;
    println!("[cast] Got client_id={}", client_id);

    // Step 2: Exchange Web Player token for a device-bound access token.
    println!("[cast] Exchanging Web Player token for device-bound token...");
    let device_access_token = refresh_device_auth(access_token, &local_device_id, &client_id)?;
    println!("[cast] Got device-bound token");

    // Step 3: addUser with the refreshed token.
    println!("[cast] Sending addUser to {}...", transport_id);
    let add_user_msg = json!({
        "type": "addUser",
        "payload": {
            "blob": device_access_token,
            "tokenType": "accesstoken",
        }
    });
    cast_device.receiver.send_message(SPOTIFY_NAMESPACE, &transport_id, &add_user_msg)
        .map_err(|e| format!("Failed to send addUser: {}", e))?;
    println!("[cast] addUser sent; waiting for response...");

    // Step 5: Wait for addUserResponse.
    let add_user_response = wait_for_message(&cast_device, SPOTIFY_NAMESPACE, "addUserResponse", 20)
        .map_err(|e| format!("addUserResponse timeout: {}", e))?;
    println!("[cast] addUserResponse: {}", add_user_response);

    Ok("Cast device authenticated successfully".to_string())
}

/// Parse `clientID` from the Cast `getInfoResponse`.
fn parse_get_info_response(payload: &str) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_str(payload)
        .map_err(|e| format!("Invalid getInfoResponse JSON: {e}"))?;

    let payload_obj = value
        .get("payload")
        .ok_or("getInfoResponse missing payload")?;

    let client_id = payload_obj
        .get("clientID")
        .or_else(|| payload_obj.get("clientId"))
        .and_then(|v| v.as_str())
        .ok_or("getInfoResponse missing clientID")?
        .to_string();

    Ok(client_id)
}

/// Exchange a Web Player token for a device-bound access token.
fn refresh_device_auth(
    web_player_token: &str,
    device_id: &str,
    client_id: &str,
) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("failed to build http client: {e}"))?;

    let body = json!({
        "clientId": client_id,
        "deviceId": device_id,
    })
    .to_string();

    let response = client
        .post(DEVICE_AUTH_URL)
        .header("Authorization", format!("Bearer {web_player_token}"))
        .header("Content-Type", "text/plain;charset=UTF-8")
        .body(body)
        .send()
        .map_err(|e| format!("device-auth refresh request failed: {e}"))?;

    let status = response.status();
    let response_body = response
        .text()
        .map_err(|e| format!("failed to read device-auth response: {e}"))?;

    if !status.is_success() {
        return Err(format!(
            "device-auth refresh failed ({}): {}",
            status, response_body
        ));
    }

    let json: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|e| format!("failed to parse device-auth response: {e} (body: {response_body})"))?;

    let access_token = json
        .get("accessToken")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("device-auth response missing accessToken: {response_body}"))?
        .to_string();

    Ok(access_token)
}

fn wait_for_message(
    cast_device: &rust_cast::CastDevice,
    namespace: &str,
    expected_type: &str,
    timeout_secs: u64,
) -> Result<String, String> {
    let start = std::time::Instant::now();

    while start.elapsed() < Duration::from_secs(timeout_secs) {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    println!("[cast] recv ns={} type={}", msg.namespace, payload.get(..120).unwrap_or(payload));
                    if msg.namespace == namespace {
                        if payload.contains(expected_type) {
                            return Ok(payload.clone());
                        }
                        // Surface errors quickly instead of waiting for timeout
                        if payload.to_lowercase().contains("error") {
                            return Err(format!("Device returned error: {}", payload));
                        }
                    }
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                let _ = cast_device.heartbeat.pong();
            }
            Ok(other) => {
                println!("[cast] recv other: {:?}", other);
            }
            Err(e) => {
                println!("[cast] receive error: {}", e);
            }
        }
    }

    Err(format!("Timeout waiting for {}", expected_type))
}
