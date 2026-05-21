use rustls::crypto::aws_lc_rs;
use std::env;
use std::time::Instant;

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let args: Vec<String> = env::args().collect();
    
    if args.len() != 4 {
        println!("Usage: cargo run --bin cast-auth-test -- <IP> <ACCESS_TOKEN> <DEVICE_NAME>");
        println!("Example: cargo run --bin cast-auth-test -- 192.168.1.9 BQ...xyz \"Living Room speaker\"");
        return;
    }

    let ip = &args[1];
    let token = &args[2];
    let device_name = &args[3];

    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║           SPX Cast Auth Test Tool                            ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();
    println!("Target: {} ({})", device_name, ip);
    println!();

    let start = Instant::now();

    // Step 1: Wake the device
    println!("🔌 Step 1: Waking device...");
    match spx_lib::commands::wake_cast_device(ip.to_string()).await {
        Ok(result) => println!("   ✅ {}", result),
        Err(e) => {
            println!("   ❌ Wake failed: {}", e);
            return;
        }
    }
    println!();

    // Step 2: Authenticate with Spotify
    println!("🔐 Step 2: Authenticating with Spotify...");
    println!("   (This sends getInfo + addUser via Cast V2)");
    
    match spx_lib::commands::authenticate_cast_device_command(
        ip.to_string(),
        token.to_string(),
        device_name.to_string(),
    ).await {
        Ok(result) => println!("   ✅ {}", result),
        Err(e) => {
            println!("   ❌ Auth failed: {}", e);
            println!();
            println!("💡 The device woke but Spotify auth failed.");
            println!("   This usually means the Cast firmware requires a different auth flow.");
            return;
        }
    }
    println!();

    // Step 3: Poll Spotify API until device appears
    println!("🔍 Step 3: Polling Spotify API for device...");
    let device_id = poll_for_device(token, device_name).await;
    
    match device_id {
        Some(id) => {
            println!("   ✅ Device found: id={}", &id[..8.min(id.len())]);
            println!();
            
            // Step 4: Transfer playback
            println!("▶️  Step 4: Transferring playback...");
            match transfer_playback(token, &id).await {
                Ok(_) => println!("   ✅ Playback transferred!"),
                Err(e) => println!("   ❌ Transfer failed: {}", e),
            }
        }
        None => {
            println!("   ❌ Device never appeared in Spotify API");
            println!();
            println!("💡 The auth may have succeeded but Spotify's API doesn't show the device.");
        }
    }
    
    println!();
    println!("⏱️  Total time: {:?}", start.elapsed());
}

async fn poll_for_device(token: &str, device_name: &str) -> Option<String> {
    let client = reqwest::Client::new();
    let target = device_name.to_lowercase();
    
    for i in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        
        if let Ok(response) = client
            .get("https://api.spotify.com/v1/me/player/devices")
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
        {
            if let Ok(text) = response.text().await {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(devices) = json.get("devices").and_then(|d| d.as_array()) {
                        if i % 5 == 0 {
                            print!("   Poll {}: {} devices", i + 1, devices.len());
                            if !devices.is_empty() {
                                let names: Vec<String> = devices.iter()
                                    .filter_map(|d| d.get("name").and_then(|n| n.as_str()))
                                    .map(|s| s.to_string())
                                    .collect();
                                print!(" — {}", names.join(", "));
                            }
                            println!();
                        }
                        
                        for device in devices {
                            if let Some(name) = device.get("name").and_then(|n| n.as_str()) {
                                if name.to_lowercase() == target 
                                    || name.to_lowercase().contains(&target)
                                    || target.contains(&name.to_lowercase()) {
                                    return device.get("id").and_then(|id| id.as_str()).map(|s| s.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    None
}

async fn transfer_playback(token: &str, device_id: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = format!(r#"{{"device_ids":["{}"],"play":true}}"#, device_id);
    
    let response = client
        .put("https://api.spotify.com/v1/me/player")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("HTTP {}: {}", status, body))
    }
}