use rustls::crypto::aws_lc_rs;
use std::str::FromStr;
use std::time::{Duration, Instant};

fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let ip = "192.168.1.9";
    println!("Launching Spotify on {}...", ip);

    let cast_device = rust_cast::CastDevice::connect_without_host_verification(ip, 8009)
        .expect("Failed to connect");

    cast_device.connection.connect("receiver-0").expect("CONNECT failed");
    
    let status = cast_device.receiver.get_status().expect("get_status failed");
    println!("Before: {} apps", status.applications.len());
    for app in &status.applications {
        println!("  - {} ({})", app.display_name, app.app_id);
    }

    // Launch Spotify
    let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753")
        .expect("Invalid app ID");
    
    println!("\nLaunching CC32E753...");
    match cast_device.receiver.launch_app(&app_id) {
        Ok(app) => {
            println!("✅ Launched: {:?}", app);
            println!("   transport_id: {}", app.transport_id);
            println!("   namespaces: {:?}", app.namespaces);
        }
        Err(e) => println!("❌ Launch failed: {}", e),
    }

    // Wait and check status
    println!("\nWaiting 3s...");
    std::thread::sleep(Duration::from_secs(3));

    let status = cast_device.receiver.get_status().expect("get_status failed");
    println!("\nAfter: {} apps", status.applications.len());
    for app in &status.applications {
        println!("  - {} ({}) - {}", app.display_name, app.app_id, app.transport_id);
        println!("    Namespaces: {:?}", app.namespaces);
    }
}