use rustls::crypto::aws_lc_rs;
use rust_cast::message_manager::CastMessagePayload;
use serde_json::json;
use std::str::FromStr;
use std::time::{Duration, Instant};

fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let ip = "192.168.1.9";
    println!("Full Auth Test on {}", ip);
    
    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .expect("Connect failed");

    // CONNECT to receiver
    cast_device.connection.connect("receiver-0").unwrap();
    println!("✓ Connected to receiver-0");

    // Get status
    let status = cast_device.receiver.get_status().unwrap();
    println!("✓ Status: {} apps", status.applications.len());
    
    // Launch or find Spotify
    let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753").unwrap();
    let launched = cast_device.receiver.launch_app(&app_id).unwrap();
    println!("✓ Launched Spotify: {}", launched.transport_id);
    println!("  Namespaces: {:?}", launched.namespaces);

    // Wait for app to be ready
    println!("\nWaiting 2s for app to initialize...");
    std::thread::sleep(Duration::from_secs(2));

    // CONNECT to the app
    cast_device.connection.connect(&launched.transport_id).unwrap();
    println!("✓ Connected to app transport_id");

    // Listen for any messages for 5s first
    println!("\nListening for messages before sending anything...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(5) {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    println!("  [{}] {} -> {}: {}", 
                        msg.namespace.split(':').last().unwrap_or(&msg.namespace),
                        msg.source,
                        msg.destination,
                        payload
                    );
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                let _ = cast_device.heartbeat.pong();
            }
            _ => {}
        }
    }

    // Send getInfo
    println!("\nSending getInfo...");
    let get_info = json!({
        "type": "getInfo",
        "payload": {
            "remoteName": "Living Room speaker",
            "deviceID": format!("{:x}", md5::compute("Living Room speaker")),
            "deviceAPI_isGroup": false,
        }
    });
    
    // Send via broadcast
    cast_device.receiver.broadcast_message(
        "urn:x-cast:com.spotify.chromecast.secure.v1",
        &get_info
    ).unwrap();
    println!("✓ Sent via broadcast: {}", get_info);

    // Listen for response
    println!("\nListening for getInfoResponse...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    println!("  [{}] {} -> {}: {}", 
                        msg.namespace.split(':').last().unwrap_or(&msg.namespace),
                        msg.source,
                        msg.destination,
                        &payload[..payload.len().min(500)]
                    );
                    
                    if payload.contains("getInfoResponse") {
                        println!("\n🎉 GOT getInfoResponse!");
                        break;
                    }
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                let _ = cast_device.heartbeat.pong();
            }
            _ => {}
        }
    }

    println!("\nDone.");
}