use rustls::crypto::aws_lc_rs;
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    // Read stored token
    let data = std::fs::read_to_string("/Users/admin/Library/Application Support/com.spx.app/spotify-auth.bin")
        .expect("No auth file");
    
    let json: serde_json::Value = serde_json::from_str(&data).unwrap();
    let token = json.get("spx_spotify_token").unwrap();
    let refresh_token = token.get("refresh_token").and_then(|r| r.as_str()).unwrap_or("");
    
    println!("Refresh token: {}...", &refresh_token[..20.min(refresh_token.len())]);
    
    // Refresh
    let client = reqwest::Client::new();
    let resp = client
        .post("https://accounts.spotify.com/api/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!(
            "grant_type=refresh_token&refresh_token={}&client_id=e1c9ee463a394fee84e031daa1665db2",
            refresh_token
        ))
        .send()
        .await
        .unwrap();
    
    println!("Status: {}", resp.status());
    let body = resp.text().await.unwrap();
    println!("Body: {}", &body[..body.len().min(500)]);
    
    // Save new token
    if let Ok(new_token) = serde_json::from_str::<serde_json::Value>(&body) {
        if let Some(access_token) = new_token.get("access_token").and_then(|a| a.as_str()) {
            println!("\nNew access token: {}...", &access_token[..30]);
            std::fs::write("/tmp/spotify_token.txt", access_token).unwrap();
            println!("Saved to /tmp/spotify_token.txt");
        }
    }
}