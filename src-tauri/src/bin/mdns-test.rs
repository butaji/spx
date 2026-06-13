use std::time::Instant;
use spx_lib::mdns;

#[tokio::main]
async fn main() {
    // Install crypto provider required by rustls (used by rust_cast)
    use rustls::crypto::aws_lc_rs;
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           SPX mDNS Local Device Scanner Test                 ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    let start = Instant::now();

    // Test 1: Google Cast
    println!("🔍 Scanning for Google Cast devices (_googlecast._tcp)...");
    let cast_start = Instant::now();
    match mdns::browse_service("_googlecast._tcp").await {
        Ok(devices) => {
            let elapsed = cast_start.elapsed();
            println!("   ✅ Found {} device(s) in {:?}", devices.len(), elapsed);
            for (i, d) in devices.iter().enumerate() {
                println!("   {}. {} at {}:{}", i + 1, d.name, d.ip, d.port);
            }
        }
        Err(e) => {
            println!("   ❌ Error: {}", e);
        }
    }
    println!();

    // Test 2: Spotify Connect
    println!("🔍 Scanning for Spotify Connect devices (_spotify-connect._tcp)...");
    let spotify_start = Instant::now();
    match mdns::browse_service("_spotify-connect._tcp").await {
        Ok(devices) => {
            let elapsed = spotify_start.elapsed();
            println!("   ✅ Found {} device(s) in {:?}", devices.len(), elapsed);
            for (i, d) in devices.iter().enumerate() {
                println!("   {}. {} at {}:{}", i + 1, d.name, d.ip, d.port);
            }
        }
        Err(e) => {
            println!("   ❌ Error: {}", e);
        }
    }
    println!();

    // Test 3: Hostname resolution
    println!("🔍 Testing hostname resolution...");
    let hostname = "Google-Nest-Mini-d7b9d4c1ef58a1f3f96c0beaa2eb16c5.local";
    let resolve_start = Instant::now();
    match mdns::resolve_hostname_to_ip(hostname).await {
        Some(ip) => {
            let elapsed = resolve_start.elapsed();
            println!("   ✅ {} → {} in {:?}", hostname, ip, elapsed);
        }
        None => {
            println!("   ❌ Failed to resolve {}", hostname);
        }
    }
    println!();

    // Test 4: Wake first Cast device
    println!("🔍 Testing Cast V2 wake on first device...");
    match mdns::browse_service("_googlecast._tcp").await {
        Ok(devices) => {
            if let Some(device) = devices.first() {
                let wake_start = Instant::now();
                match spx_lib::commands::wake_cast_device(device.ip.clone()).await {
                    Ok(result) => {
                        let elapsed = wake_start.elapsed();
                        println!("   ✅ Woke '{}' in {:?}: {}", device.name, elapsed, result);
                    }
                    Err(e) => {
                        let elapsed = wake_start.elapsed();
                        println!("   ❌ Failed to wake '{}' in {:?}: {}", device.name, elapsed, e);
                    }
                }
            } else {
                println!("   ⚠️  No Cast devices found to test wake");
            }
        }
        Err(e) => {
            println!("   ❌ Error scanning for devices: {}", e);
        }
    }
    println!();

    let total = start.elapsed();
    println!("⏱️  Total scan time: {:?}", total);
    println!();
    println!("If 0 devices were found but you know they exist on your network,");
    println!("check that dns-sd is available: run `which dns-sd` in terminal.");
}
