use rustls::crypto::aws_lc_rs;
use std::str::FromStr;
use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let token = std::fs::read_to_string("/tmp/spotify_token.txt")
        .expect("No token file. Run SPX first to authenticate.");
    let token = token.trim();

    let ip = "192.168.1.9";
    let device_name = "Living Room speaker";

    println!("Simple Cast Transfer Test");
    println!("=========================\n");

    let start = Instant::now();

    // Step 1: Wake device
    println!("1. Waking {}...", ip);
    let ip_owned = ip.to_string();
    let result = tokio::task::spawn_blocking(move || {
        let cast_device = rust_cast::CastDevice::connect_without_host_verification(&ip_owned, 8009)
            .map_err(|e| format!("Connect failed: {}", e))?;
        cast_device.connection.connect("receiver-0")
            .map_err(|e| format!("CONNECT failed: {}", e))?;
        
        let status = cast_device.receiver.get_status()
            .map_err(|e| format!("get_status failed: {}", e))?;
        let has_spotify = status.applications.iter().any(|a| a.display_name.to_lowercase().contains("spotify"));
        
        if !has_spotify {
            println!("   Launching Spotify app...");
            let app_id = rust_cast::channels::receiver::CastDeviceApp::from_str("CC32E753")
                .map_err(|_| "Invalid app ID".to_string())?;
            cast_device.receiver.launch_app(&app_id)
                .map_err(|e| format!("Launch failed: {}", e))?;
            println!("   ✅ Spotify app launched");
        } else {
            println!("   ✅ Spotify already running");
        }
        
        Ok::<_, String>(())
    });
    
    match tokio::time::timeout(Duration::from_secs(10), result).await {
        Ok(Ok(Ok(()))) => {},
        Ok(Ok(Err(e))) => { println!("   ❌ Wake failed: {}", e); return; }
        Ok(Err(_)) => { println!("   ❌ Task panicked"); return; }
        Err(_) => { println!("   ❌ Wake timed out"); return; }
    }

    // Step 2: Poll Spotify API
    println!("\n2. Polling Spotify API for '{}'...", device_name);
    let client = reqwest::Client::new();
    let target = device_name.to_lowercase();
    let mut device_id = None;
    
    for i in 0..30 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        
        let resp = match client
            .get("https://api.spotify.com/v1/me/player/devices")
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                if i == 0 { println!("   Request error: {}", e); }
                continue;
            }
        };
        
        if !resp.status().is_success() {
            if i == 0 { println!("   API error: HTTP {}", resp.status()); }
            continue;
        }
        
        let text = match resp.text().await {
            Ok(t) => t,
            Err(e) => {
                if i == 0 { println!("   Read error: {}", e); }
                continue;
            }
        };
        
        let json = match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(j) => j,
            Err(e) => {
                if i == 0 { println!("   JSON error: {}", e); }
                continue;
            }
        };
        
        let devices = match json.get("devices").and_then(|d| d.as_array()) {
            Some(d) => d,
            None => {
                if i == 0 { println!("   No devices field in response"); }
                continue;
            }
        };
        
        if i % 5 == 0 || i >= 28 {
            let names: Vec<String> = devices.iter()
                .filter_map(|d| d.get("name").and_then(|n| n.as_str()))
                .map(|s| s.to_string())
                .collect();
            println!("   Poll {}: {} devices — {}", i + 1, devices.len(), names.join(", "));
        }
        
        for device in devices {
            if let Some(name) = device.get("name").and_then(|n| n.as_str()) {
                if name.to_lowercase() == target || name.to_lowercase().contains(&target) {
                    device_id = device.get("id").and_then(|id| id.as_str()).map(|s| s.to_string());
                    println!("   ✅ FOUND: '{}' with id={}", name, device_id.as_ref().unwrap());
                    break;
                }
            }
        }
        
        if device_id.is_some() { break; }
    }

    // Step 3: Transfer playback
    if let Some(id) = device_id {
        println!("\n3. Transferring playback to device...");
        let body = format!(r#"{{"device_ids":["{}"],"play":true}}"#, id);
        
        match client
            .put("https://api.spotify.com/v1/me/player")
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    println!("   ✅ Playback transferred! Music should be playing.");
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    println!("   ❌ Transfer failed: HTTP {} — {}", status, body);
                }
            }
            Err(e) => println!("   ❌ Request failed: {}", e),
        }
    } else {
        println!("\n   ❌ Device never appeared in Spotify API");
        println!("      The Cast device is awake but Spotify's API doesn't see it.");
    }

    println!("\n⏱️  Total time: {:?}", start.elapsed());
}