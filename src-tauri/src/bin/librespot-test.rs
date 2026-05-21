use rustls::crypto::aws_lc_rs;
use std::time::Instant;

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let token = std::fs::read_to_string("/tmp/spotify_token.txt")
        .expect("No token file");
    let token = token.trim();

    println!("Librespot Connection Test");
    println!("=========================\n");
    println!("Token: {}...", &token[..30.min(token.len())]);

    // Get username from Web API first
    println!("\n1. Fetching user profile from Web API...");
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.spotify.com/v1/me")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .unwrap();
    
    if !resp.status().is_success() {
        println!("   ❌ API error: HTTP {}", resp.status());
        return;
    }

    let profile: serde_json::Value = resp.json().await.unwrap();
    let username = profile.get("id").and_then(|u| u.as_str()).unwrap_or("unknown");
    let display_name = profile.get("display_name").and_then(|u| u.as_str()).unwrap_or(username);
    println!("   ✅ User: {} ({})", display_name, username);

    // Try librespot connection
    println!("\n2. Creating librespot session...");
    let start = Instant::now();
    
    match spx_lib::librespot_client::test_librespot(token, username).await {
        Ok(result) => {
            println!("   ✅ {}", result);
            println!("   Time: {:?}", start.elapsed());
        }
        Err(e) => {
            println!("   ❌ {}", e);
            println!("   Time: {:?}", start.elapsed());
        }
    }
}