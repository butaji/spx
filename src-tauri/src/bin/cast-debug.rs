use rustls::crypto::aws_lc_rs;
use rust_cast::message_manager::CastMessagePayload;
use serde_json::json;
use std::env;
use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let args: Vec<String> = env::args().collect();
    
    if args.len() != 4 {
        println!("Usage: cargo run --bin cast-debug -- <IP> <ACCESS_TOKEN> <DEVICE_NAME>");
        return;
    }

    let ip = &args[1];
    let token = &args[2];
    let device_name = &args[3];

    println!("Cast Auth Debug - Testing {} ({})", device_name, ip);
    println!();

    // Connect to Cast device
    println!("Connecting to {}:8009...", ip);
    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .expect("Failed to connect");
    println!("Connected!");

    // Send CONNECT
    println!("Sending CONNECT to receiver-0...");
    cast_device.connection.connect("receiver-0").expect("CONNECT failed");

    // Check status
    println!("Getting receiver status...");
    let status = cast_device.receiver.get_status().expect("get_status failed");
    println!("Status: {} apps running", status.applications.len());
    for app in &status.applications {
        println!("  - {} ({}) - transport_id={}", app.display_name, app.app_id, app.transport_id);
        println!("    Namespaces: {:?}", app.namespaces);
    }

    // Find Spotify
    let spotify = status.applications.iter()
        .find(|a| a.display_name.to_lowercase().contains("spotify"));

    if let Some(app) = spotify {
        println!();
        println!("Spotify is running. Connecting to transport_id={}...", app.transport_id);
        cast_device.connection.connect(&app.transport_id).expect("CONNECT to app failed");
        
        // Send getInfo
        println!();
        println!("Sending getInfo message...");
        let get_info = json!({
            "type": "getInfo",
            "payload": {
                "remoteName": device_name,
                "deviceID": format!("{:x}", md5::compute(device_name)),
                "deviceAPI_isGroup": false,
            }
        });
        
        cast_device.receiver.broadcast_message(
            "urn:x-cast:com.spotify.chromecast.secure.v1",
            &get_info
        ).expect("Failed to send getInfo");
        println!("Sent getInfo: {}", get_info);
        
        // Listen for responses
        println!();
        println!("Listening for responses (10s)...");
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(10) {
            match cast_device.receive() {
                Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                    if let CastMessagePayload::String(payload) = &msg.payload {
                        println!("[{}] {}", msg.namespace.split(':').last().unwrap_or(&msg.namespace), &payload[..payload.len().min(300)]);
                    }
                }
                Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                    let _ = cast_device.heartbeat.pong();
                }
                Ok(_) => {}
                Err(e) => println!("[ERROR] {}", e),
            }
        }
        
        // Try addUser
        println!();
        println!("Sending addUser message...");
        let add_user = json!({
            "type": "addUser",
            "payload": {
                "blob": token,
                "tokenType": "accesstoken",
            }
        });
        
        cast_device.receiver.broadcast_message(
            "urn:x-cast:com.spotify.chromecast.secure.v1",
            &add_user
        ).expect("Failed to send addUser");
        println!("Sent addUser");
        
        // Listen for responses
        println!();
        println!("Listening for responses (10s)...");
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(10) {
            match cast_device.receive() {
                Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                    if let CastMessagePayload::String(payload) = &msg.payload {
                        println!("[{}] {}", msg.namespace.split(':').last().unwrap_or(&msg.namespace), &payload[..payload.len().min(300)]);
                    }
                }
                Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                    let _ = cast_device.heartbeat.pong();
                }
                Ok(_) => {}
                Err(e) => println!("[ERROR] {}", e),
            }
        }
    } else {
        println!("Spotify not running on this device");
    }

    println!();
    println!("Done.");
}