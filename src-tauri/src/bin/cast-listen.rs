use rust_cast::message_manager::CastMessagePayload;
use std::time::{Duration, Instant};

const SPOTIFY_APP_ID: &str = "CC32E753";

#[tokio::main]
async fn main() {
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install crypto provider");
    let addr = "192.168.1.12:8009";
    println!("Cast Device Listener");
    println!("====================");
    println!("Connecting to {}...\n", addr);

    let device = rust_cast::CastDevice::connect_without_host_verification("192.168.1.12", 8009)
        .expect("Failed to connect");

    println!("✅ Connected");

    device.connection.connect("receiver-0").expect("CONNECT failed");
    println!("✅ Connection channel opened");

    let status = device.receiver.get_status().expect("get_status failed");
    println!("📊 Status: {} apps running", status.applications.len());
    for app in &status.applications {
        println!("  - {} ({}) - transport={}", app.display_name, app.app_id, app.transport_id);
        println!("    Namespaces: {:?}", app.namespaces);
    }

    // Launch Spotify
    println!("\n🚀 Launching Spotify app ({})...", SPOTIFY_APP_ID);
    let _ = device.receiver.launch_app(&std::str::FromStr::from_str(SPOTIFY_APP_ID).unwrap()
    ).expect("Launch failed");

    tokio::time::sleep(Duration::from_secs(3)).await;

    let status2 = device.receiver.get_status().expect("get_status failed");
    println!("\n📊 Status after launch: {} apps", status2.applications.len());

    if let Some(app) = status2.applications.iter().find(|a| a.app_id == SPOTIFY_APP_ID) {
        println!("\n📱 Spotify app found:");
        println!("   Session: {}", app.session_id);
        println!("   Transport: {}", app.transport_id);
        println!("   Namespaces: {:?}", app.namespaces);

        if !app.transport_id.is_empty() {
            let transport = &app.transport_id;
            println!("\n🔗 Connecting to transport {}...", transport);
            device.connection.connect(transport).expect("CONNECT to app failed");
            println!("✅ Connected to app transport");

            println!("\n👂 Listening for messages for 20 seconds...\n");

            let start = Instant::now();
            while start.elapsed() < Duration::from_secs(20) {
                match device.receive() {
                    Ok(rust_cast::ChannelMessage::Raw(msg)) => {
                        if let CastMessagePayload::String(payload) = &msg.payload {
                            println!("📨 [{}] {}", msg.namespace, payload);
                        } else {
                            println!("📨 [{}] (binary)", msg.namespace);
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        if !e.to_string().contains("TimedOut") {
                            println!("⚠️  Error: {}", e);
                        }
                    }
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        }
    } else {
        println!("\n❌ Spotify app not found in status");
    }

    println!("\nDone.");
}
