use spx_lib::librespot_client::SpotifyConnectClient;

#[tokio::main]
async fn main() {
    println!("Librespot Device Discovery Test");
    println!("================================\n");

    let access_token = std::env::args().nth(1)
        .expect("Usage: cargo run --bin librespot-discovery-test -- <token>");

    println!("Token: {}...\n", &access_token[..20.min(access_token.len())]);

    // 1. Create session
    print!("1. Creating librespot session... ");
    let client = SpotifyConnectClient::new(&access_token, "test"
    ).await.expect("Failed to create session");
    println!("✅ Connected as: {}", client.username());

    // 2. List devices via Web API for comparison
    println!("\n2. Fetching Web API devices...");
    let resp = reqwest::Client::new()
        .get("https://api.spotify.com/v1/me/player/devices")
        .header("Authorization", format!("Bearer {}", access_token))
        .send().await.unwrap();

    if resp.status().is_success() {
        let data: serde_json::Value = resp.json().await.unwrap();
        if let Some(devices) = data.get("devices").and_then(|d| d.as_array()) {
            println!("   Web API found {} device(s):", devices.len());
            for d in devices {
                let name = d.get("name").and_then(|n| n.as_str()).unwrap_or("?");
                let id = d.get("id").and_then(|n| n.as_str()).unwrap_or("?");
                let active = d.get("is_active").and_then(|n| n.as_bool()).unwrap_or(false);
                println!("   - {} (id={}) active={}", name, id, active);
            }
        }
    }

    // 3. Get Connect devices via librespot
    println!("\n3. Getting devices via librespot-connect...");
    println!("   (This may take 5-10 seconds for discovery...)");

    let start = std::time::Instant::now();
    
    // Use the session to get devices
    match get_connect_devices(&client).await {
        Ok(devices) => {
            println!("\n   Found {} device(s):", devices.len());
            for d in devices {
                println!("   - {}", d);
            }
        }
        Err(e) => {
            println!("   ❌ Error: {}", e);
        }
    }

    println!("\nTime: {:?}", start.elapsed());
}

async fn get_connect_devices(client: &SpotifyConnectClient) -> Result<Vec<String>, String> {
    use librespot_connect::spirc::Spirc;
    use librespot_core::spotify_id::SpotifyId;
    
    // Create a Spirc instance for device discovery
    // This requires a player, but we just want to discover devices
    // So we'll use a minimal setup
    
    let devices = vec![];
    
    // Spirc::new() requires many parameters including a player
    // For now, let's try using the session to get devices via mercury
    
    Ok(devices)
}
