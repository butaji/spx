use std::str::FromStr;
use std::time::Duration;
use rust_cast::message_manager::CastMessagePayload;
use serde_json::json;
use tracing::{info, debug, warn};

const SPOTIFY_APP_ID: &str = "CC32E753";
const SPOTIFY_NAMESPACE: &str = "urn:x-cast:com.spotify.chromecast.secure.v1";

/// Authenticate a Cast device with Spotify so it appears in the Web API.
/// This implements the Spotcast-style auth flow.
pub fn authenticate_cast_device(
    ip: &str,
    access_token: &str,
    device_name: &str,
) -> Result<String, String> {
    info!("Starting Cast auth for {} at {}", device_name, ip);

    // Connect to Cast device
    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .map_err(|e| format!("Cast connect failed: {}", e))?;

    // Step 1: Send CONNECT on connection namespace
    cast_device.connection.connect("receiver-0")
        .map_err(|e| format!("CONNECT failed: {}", e))?;
    info!("Sent CONNECT to receiver-0");

    // Step 2: Check receiver status
    let status = cast_device.receiver.get_status()
        .map_err(|e| format!("get_status failed: {}", e))?;

    // Find Spotify app or launch it
    let spotify_app = status.applications.iter()
        .find(|app| app.app_id == SPOTIFY_APP_ID || app.display_name.to_lowercase().contains("spotify"));

    let transport_id = if let Some(app) = spotify_app {
        info!("Spotify already running, transport_id={}", app.transport_id);
        app.transport_id.clone()
    } else {
        // Launch Spotify app
        info!("Launching Spotify app...");
        let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str(SPOTIFY_APP_ID)
            .map_err(|_| "Invalid Spotify app ID".to_string())?;
        let launched = cast_device.receiver.launch_app(&app_id)
            .map_err(|e| format!("Launch failed: {}", e))?;
        info!("Launched Spotify, transport_id={}", launched.transport_id);
        launched.transport_id
    };

    // Step 3: CONNECT to the Spotify app
    cast_device.connection.connect(&transport_id)
        .map_err(|e| format!("CONNECT to app failed: {}", e))?;
    info!("Connected to Spotify app");

    // Step 4: Send getInfo on Spotify namespace using broadcast_message
    let get_info_msg = json!({
        "type": "getInfo",
        "payload": {
            "remoteName": device_name,
            "deviceID": format!("{:x}", md5::compute(device_name)),
            "deviceAPI_isGroup": false,
        }
    });

    cast_device.receiver.broadcast_message(SPOTIFY_NAMESPACE, &get_info_msg)
        .map_err(|e| format!("Failed to send getInfo: {}", e))?;
    info!("Sent getInfo");

    // Step 5: Wait for getInfoResponse
    let get_info_response = wait_for_message(&cast_device, SPOTIFY_NAMESPACE, "getInfoResponse", 10)
        .map_err(|e| format!("getInfoResponse timeout: {}", e))?;
    
    debug!("getInfoResponse: {}", get_info_response);

    // Step 6: Send addUser with access token using broadcast_message
    let add_user_msg = json!({
        "type": "addUser",
        "payload": {
            "blob": access_token,
            "tokenType": "accesstoken",
        }
    });

    cast_device.receiver.broadcast_message(SPOTIFY_NAMESPACE, &add_user_msg)
        .map_err(|e| format!("Failed to send addUser: {}", e))?;
    info!("Sent addUser");

    // Step 7: Wait for addUserResponse
    let add_user_response = wait_for_message(&cast_device, SPOTIFY_NAMESPACE, "addUserResponse", 10)
        .map_err(|e| format!("addUserResponse timeout: {}", e))?;
    
    info!("addUserResponse: {}", add_user_response);

    Ok("Cast device authenticated successfully".to_string())
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
                if msg.namespace == namespace {
                    if let CastMessagePayload::String(payload) = &msg.payload {
                        debug!("Received on {}: {}", namespace, payload);
                        if payload.contains(expected_type) {
                            return Ok(payload.clone());
                        }
                    }
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                // Send PONG to keep connection alive
                let _ = cast_device.heartbeat.pong();
            }
            Ok(_) => {}
            Err(e) => {
                warn!("Receive error: {}", e);
            }
        }
    }
    
    Err(format!("Timeout waiting for {}", expected_type))
}