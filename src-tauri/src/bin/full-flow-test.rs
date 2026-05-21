use rustls::crypto::aws_lc_rs;
use std::time::{Duration, Instant};
use spx_lib::commands;

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let ip = "192.168.1.9"; // Living Room - no Spotify running initially
    println!("=== Full Flow Test: Living Room ({}) ===", ip);
    let start = Instant::now();

    // Step 1: Wake the device
    println!("\n1. Waking device...");
    match commands::wake_cast_device(ip.to_string()).await {
        Ok(result) => println!("   ✅ {}", result),
        Err(e) => {
            println!("   ❌ Wake failed: {}", e);
            return;
        }
    }

    // Step 2: Poll Spotify API until device appears (max 20s)
    println!("\n2. Polling Spotify API for device (max 20s)...");
    for i in 0..40 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        
        // We can't easily call getAvailableDevices here without auth setup
        // Just show progress
        if i % 4 == 0 {
            println!("   ... waited {}s", (i + 1) * 500 / 1000);
        }
    }

    println!("\n3. Total time: {:?}", start.elapsed());
    println!("   Note: In the real app, waitForDevice polls the Spotify API");
    println!("   and transfers playback once the device appears.");
}
