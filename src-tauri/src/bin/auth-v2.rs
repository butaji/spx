use rustls::crypto::aws_lc_rs;
use rust_cast::message_manager::{CastMessage, CastMessagePayload};
use serde_json::json;
use std::str::FromStr;
use std::time::{Duration, Instant};

fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let ip = "192.168.1.9";
    println!("Auth Test v2 on {}", ip);
    
    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .expect("Connect failed");

    cast_device.connection.connect("receiver-0").unwrap();
    
    // Launch Spotify
    let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753").unwrap();
    let launched = cast_device.receiver.launch_app(&app_id).unwrap();
    println!("Launched: {}", launched.transport_id);

    // Wait 5s for full initialization
    println!("Waiting 5s for app to fully initialize...");
    std::thread::sleep(Duration::from_secs(5));

    // CONNECT to the app
    cast_device.connection.connect(&launched.transport_id).unwrap();

    // Listen for any messages first
    println!("\nListening for 3s...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(3) {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    println!("  [RECV {}] {}", msg.namespace.split(':').last().unwrap_or(&msg.namespace), &payload[..payload.len().min(200)]);
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => { let _ = cast_device.heartbeat.pong(); }
            _ => {}
        }
    }

    // Try sending directly using message_manager through reflection or another way
    // Actually, let's just try the broadcast again but wait longer
    println!("\nSending getInfo via broadcast...");
    let get_info = json!({
        "type": "getInfo",
        "payload": {
            "remoteName": "Living Room speaker",
            "deviceID": format!("{:x}", md5::compute("Living Room speaker")),
            "deviceAPI_isGroup": false,
        }
    });
    
    cast_device.receiver.broadcast_message(
        "urn:x-cast:com.spotify.chromecast.secure.v1",
        &get_info
    ).unwrap();
    println!("Sent: {}", get_info);

    // Listen for 20s
    println!("\nListening for 20s...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(20) {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    let ns = msg.namespace.split(':').last().unwrap_or(&msg.namespace);
                    if ns.contains("spotify") || payload.contains("Info") || payload.contains("User") {
                        println!("  [RECV {}] {}", ns, &payload[..payload.len().min(500)]);
                    }
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => { let _ = cast_device.heartbeat.pong(); }
            _ => {}
        }
    }

    println!("\nDone - no response from Spotify app.");
}