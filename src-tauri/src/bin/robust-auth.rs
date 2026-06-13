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
    let device_name = "Living Room speaker";
    
    println!("Robust Cast Auth Test");
    println!("=====================\n");

    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .expect("Connect failed");

    // Step 1: Connect to receiver
    println!("1. Connecting to receiver-0...");
    cast_device.connection.connect("receiver-0").unwrap();
    println!("   ✅ Connected");

    // Step 2: Check current status
    println!("\n2. Checking receiver status...");
    let status = cast_device.receiver.get_status().unwrap();
    println!("   {} apps running", status.applications.len());
    for app in &status.applications {
        println!("   - {} ({}) - {}", app.display_name, app.app_id, app.transport_id);
    }

    // Step 3: Launch Spotify
    let transport_id = if let Some(app) = status.applications.iter().find(|a| a.display_name.to_lowercase().contains("spotify")) {
        println!("\n3. Spotify already running");
        app.transport_id.clone()
    } else {
        println!("\n3. Launching Spotify...");
        let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753").unwrap();
        let launched = cast_device.receiver.launch_app(&app_id).unwrap();
        println!("   ✅ Launched: {}", launched.transport_id);
        launched.transport_id
    };

    // Step 4: Wait and poll status
    println!("\n4. Waiting for app to fully initialize...");
    std::thread::sleep(Duration::from_secs(3));
    
    let status = cast_device.receiver.get_status().unwrap();
    if let Some(app) = status.applications.iter().find(|a| a.transport_id == transport_id) {
        println!("   App status: {} ({})", app.display_name, app.status_text);
        println!("   Namespaces: {:?}", app.namespaces);
    }

    // Step 5: Connect to the app
    println!("\n5. Connecting to app transport_id...");
    cast_device.connection.connect(&transport_id).unwrap();
    println!("   ✅ Connected to {}", transport_id);

    // Step 6: Listen for any messages first (10s)
    println!("\n6. Listening for messages (10s)...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    let ns = msg.namespace.split(':').last().unwrap_or(&msg.namespace);
                    println!("   [RECV {}] {} -> {}: {}", 
                        ns, msg.source, msg.destination,
                        &payload[..payload.len().min(200)]
                    );
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                println!("   [HEARTBEAT] Sending PONG");
                let _ = cast_device.heartbeat.pong();
            }
            Ok(rust_cast::ChannelMessage::Connection(res)) => {
                println!("   [CONNECTION] {:?}", res);
            }
            Ok(_) => {}
            Err(e) => println!("   [ERROR] {}", e),
        }
    }

    // Step 7: Send getInfo directly to transport_id
    println!("\n7. Sending getInfo directly to transport_id...");
    let get_info = json!({
        "type": "getInfo",
        "payload": {
            "remoteName": device_name,
            "deviceID": format!("{:x}", md5::compute(device_name)),
            "deviceAPI_isGroup": false,
        }
    });
    
    // Send via broadcast (message_manager is private)
    cast_device.receiver.broadcast_message(
        "urn:x-cast:com.spotify.chromecast.secure.v1",
        &get_info
    ).unwrap();
    println!("   ✅ Sent getInfo via broadcast");

    // Step 8: Listen for getInfoResponse (15s)
    println!("\n8. Listening for getInfoResponse (15s)...");
    let start = Instant::now();
    let mut found = false;
    while start.elapsed() < Duration::from_secs(15) && !found {
        match cast_device.receive() {
            Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    let ns = msg.namespace.split(':').last().unwrap_or(&msg.namespace);
                    if ns.contains("spotify") || payload.contains("Info") || payload.contains("Response") {
                        println!("   [RECV {}] {}", ns, &payload[..payload.len().min(500)]);
                        if payload.contains("getInfoResponse") {
                            found = true;
                            println!("\n   🎉 GOT getInfoResponse!");
                        }
                    }
                }
            }
            Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                let _ = cast_device.heartbeat.pong();
            }
            Ok(_) => {}
            Err(e) => println!("   [ERROR] {}", e),
        }
    }

    if !found {
        println!("\n   ❌ No getInfoResponse received");
    }

    println!("\nDone.");
}