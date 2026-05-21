use rustls::crypto::aws_lc_rs;
use std::time::Instant;

#[tokio::main]
async fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let devices = vec![
        ("Mini2 (Spotify running)", "192.168.1.14"),
        ("Living Room (no apps)", "192.168.1.9"),
        ("Bedroom (Spotify running)", "192.168.1.12"),
        ("Living Room2 (no apps)", "192.168.1.11"),
    ];

    for (name, ip) in devices {
        println!("\nTesting wake_cast_device on {} ...", name);
        let start = Instant::now();

        match spx_lib::commands::wake_cast_device(ip.to_string()).await {
            Ok(result) => println!("  ✅ Success: {} (took {:?})", result, start.elapsed()),
            Err(e) => println!("  ❌ Error: {} (took {:?})", e, start.elapsed()),
        }
    }
}
