use rustls::crypto::aws_lc_rs;
use rust_cast::message_manager::CastMessagePayload;
use serde_json::json;
use std::time::{Duration, Instant};

const SPOTIFY_APP_ID: &str = "CC32E753";
const NAMESPACE_SECURE: &str = "urn:x-cast:com.spotify.chromecast.secure.v1";
const NAMESPACE_V1: &str = "urn:x-cast:com.spotify.chromecast.v1";
const NAMESPACE_UNSAFE: &str = "urn:x-cast:com.spotify.chromecast.unsafe.v1";

fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install crypto provider");

    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        println!("Usage: cargo run --bin cast-auth-brute -- <IP> <ACCESS_TOKEN>");
        return;
    }

    let ip = &args[1];
    let token = &args[2];

    println!("Cast Auth Brute Force Test");
    println!("==========================");
    println!("Device: {}\n", ip);

    // Connect
    let device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .expect("Failed to connect");
    device.connection.connect("receiver-0").expect("CONNECT failed");
    println!("✅ Connected\n");

    // Launch Spotify
    println!("🚀 Launching Spotify app...");
    device.receiver.launch_app(
        &std::str::FromStr::from_str(SPOTIFY_APP_ID).unwrap()
    ).expect("Launch failed");

    std::thread::sleep(Duration::from_secs(3));

    let status = device.receiver.get_status().expect("get_status failed");
    let app = status.applications.iter()
        .find(|a| a.app_id == SPOTIFY_APP_ID)
        .expect("Spotify app not found");

    println!("✅ App running, transport={}\n", app.transport_id);
    device.connection.connect(&app.transport_id).expect("CONNECT to app failed");

    // Try many auth message variations
    let tests = vec![
        // Test 1: getInfo with payload wrapper
        ("getInfo-payload", NAMESPACE_SECURE, json!({
            "type": "getInfo",
            "payload": {
                "remoteName": "SPX",
                "deviceID": "test123",
                "deviceAPI_isGroup": false,
            }
        })),
        // Test 2: getInfo without payload wrapper
        ("getInfo-flat", NAMESPACE_SECURE, json!({
            "type": "getInfo",
            "remoteName": "SPX",
            "deviceID": "test123",
            "version": "2.1.0",
        })),
        // Test 3: addUser with accesstoken
        ("addUser-token", NAMESPACE_SECURE, json!({
            "type": "addUser",
            "payload": {
                "blob": token,
                "tokenType": "accesstoken",
            }
        })),
        // Test 4: addUser without payload wrapper
        ("addUser-flat", NAMESPACE_SECURE, json!({
            "type": "addUser",
            "blob": token,
            "tokenType": "accesstoken",
        })),
        // Test 5: login
        ("login", NAMESPACE_SECURE, json!({
            "type": "login",
            "token": token,
        })),
        // Test 6: authenticate
        ("authenticate", NAMESPACE_SECURE, json!({
            "type": "authenticate",
            "credentials": token,
        })),
        // Test 7: getInfo on v1 namespace
        ("getInfo-v1", NAMESPACE_V1, json!({
            "type": "getInfo",
            "version": "2.1.0",
        })),
        // Test 8: handshake
        ("handshake", NAMESPACE_SECURE, json!({
            "type": "handshake",
            "version": "2.1.0",
        })),
        // Test 9: ready
        ("ready", NAMESPACE_SECURE, json!({
            "type": "ready",
            "deviceID": "test123",
        })),
        // Test 10: GetInfo (capital G)
        ("GetInfo", NAMESPACE_SECURE, json!({
            "type": "GetInfo",
            "version": "2.1.0",
        })),
    ];

    for (name, namespace, msg) in tests {
        println!("\n📤 Test: {} on {}", name, namespace.split(':').last().unwrap());
        println!("   Sending: {}", msg.to_string());

        device.receiver.broadcast_message(namespace, &msg)
            .expect("Failed to send");

        // Listen for 5 seconds
        println!("   Listening...");
        let start = Instant::now();
        let mut got_response = false;
        while start.elapsed() < Duration::from_secs(5) {
            match device.receive() {
                Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                    if let CastMessagePayload::String(payload) = &msg.payload {
                        if msg.namespace.contains("spotify") {
                            println!("   📨 RESPONSE: [{}] {}", 
                                msg.namespace.split(':').last().unwrap_or("?"),
                                &payload[..payload.len().min(200)]);
                            got_response = true;
                        }
                    }
                }
                Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                    let _ = device.heartbeat.pong();
                }
                Ok(_) => {}
                Err(e) => {
                    if !e.to_string().contains("TimedOut") {
                        println!("   ⚠️  Error: {}", e);
                    }
                }
            }
        }

        if !got_response {
            println!("   ❌ No response");
        }
    }

    println!("\n\nDone. If any test got a response, that's our auth format!");
}
