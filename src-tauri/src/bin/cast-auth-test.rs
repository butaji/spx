use rust_cast::message_manager::{CastMessage, CastMessagePayload, MessageManager};
use rustls::{ClientConfig, ClientConnection};
use rustls::pki_types::ServerName;
use serde_json::json;
use std::sync::Arc;
use std::time::{Duration, Instant};
use std::net::TcpStream;
use rustls::StreamOwned;

#[derive(Debug)]
struct NoCertificateVerification;

impl rustls::client::danger::ServerCertVerifier for NoCertificateVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer,
        _intermediates: &[rustls::pki_types::CertificateDer],
        _server_name: &ServerName,
        _ocsp: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
        ]
    }
}

fn send_json(
    mm: &MessageManager<StreamOwned<ClientConnection, TcpStream>>, 
    namespace: &str, 
    source: &str, 
    dest: &str, 
    payload: serde_json::Value
) -> Result<(), String> {
    mm.send(CastMessage {
        namespace: namespace.to_string(),
        source: source.to_string(),
        destination: dest.to_string(),
        payload: CastMessagePayload::String(payload.to_string()),
    }).map_err(|e| format!("Send error: {}", e))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        println!("Usage: cargo run --bin cast-auth-test -- <IP> <ACCESS_TOKEN>");
        println!("Example: cargo run --bin cast-auth-test -- 192.168.1.11 BQ...");
        return;
    }

    let ip = &args[1];
    let token = &args[2];

    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║     Cast Auth Protocol Test (Comprehensive)                  ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!("Device: {}:8009\n", ip);

    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install crypto provider");

    let config = ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoCertificateVerification))
        .with_no_client_auth();

    let server_name = ServerName::try_from(ip.as_str()).unwrap().to_owned();
    let conn = ClientConnection::new(Arc::new(config), server_name).unwrap();
    let stream = TcpStream::connect((ip.as_str(), 8009)).unwrap();
    let tls_stream = StreamOwned::new(conn, stream);

    println!("[1/7] ✅ TLS connected\n");

    let mm = MessageManager::new(tls_stream);
    let sender_id = "sender-0";

    // Step 1: CONNECT to receiver-0
    println!("[2/7] Sending CONNECT to receiver-0 with Spotify userAgent...");
    send_json(
        &mm, 
        "urn:x-cast:com.google.cast.tp.connection", 
        sender_id, 
        "receiver-0",
        json!({
            "type": "CONNECT",
            "origin": {},
            "userAgent": "Spotify/1234567890",
            "senderInfo": {
                "sdkType": 2,
                "version": "1.0.0",
                "platform": 4,
                "connectionType": 1
            }
        })
    ).unwrap();
    println!("      ✅ CONNECT sent\n");

    // Step 2: PING
    println!("[3/7] Sending PING...");
    send_json(
        &mm, 
        "urn:x-cast:com.google.cast.tp.heartbeat", 
        sender_id, 
        "receiver-0",
        json!({"type": "PING"})
    ).unwrap();

    // Listen for 2 seconds
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(2) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    println!("      📨 [{}] {}", msg.namespace.split(':').last().unwrap_or("?"), payload);
                }
            }
            Err(_) => {}
        }
    }
    println!();

    // Step 3: LAUNCH
    println!("[4/7] Launching Spotify app (CC32E753)...");
    send_json(
        &mm, 
        "urn:x-cast:com.google.cast.receiver", 
        sender_id, 
        "receiver-0",
        json!({
            "type": "LAUNCH",
            "appId": "CC32E753",
            "requestId": 1
        })
    ).unwrap();
    println!("      ✅ LAUNCH sent\n");

    // Step 4: Wait for RECEIVER_STATUS
    println!("[5/7] Waiting for RECEIVER_STATUS with app info...");
    let mut transport_id = String::new();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    if payload.contains("RECEIVER_STATUS") || payload.contains("LAUNCH_ERROR") {
                        println!("      📊 {}", &payload[..payload.len().min(600)]);
                        
                        if let Ok(status) = serde_json::from_str::<serde_json::Value>(payload) {
                            if let Some(apps) = status.get("status").and_then(|s| s.get("applications")) {
                                if let Some(app_array) = apps.as_array() {
                                    for app in app_array {
                                        if app.get("appId").and_then(|a| a.as_str()) == Some("CC32E753") {
                                            transport_id = app.get("transportId")
                                                .and_then(|t| t.as_str())
                                                .unwrap_or("")
                                                .to_string();
                                            println!("      ✅ Found Spotify app, transportId={}", transport_id);
                                        }
                                    }
                                }
                            }
                        }
                        if !transport_id.is_empty() {
                            break;
                        }
                    }
                }
            }
            Err(_) => {}
        }
    }

    if transport_id.is_empty() {
        println!("      ❌ No Spotify app transportId found\n");
        return;
    }
    println!();

    // Step 5: CONNECT to app transport
    println!("[6/7] Sending CONNECT to transport {}...", transport_id);
    send_json(
        &mm, 
        "urn:x-cast:com.google.cast.tp.connection", 
        sender_id, 
        &transport_id,
        json!({
            "type": "CONNECT",
            "origin": {},
            "userAgent": "Spotify/1234567890",
            "senderInfo": {
                "sdkType": 2,
                "version": "1.0.0",
                "platform": 4,
                "connectionType": 1
            }
        })
    ).unwrap();
    println!("      ✅ App CONNECT sent\n");

    // Step 6: Try multiple auth approaches
    println!("[7/7] Trying auth approaches...\n");

    // Approach 1: Send getInfo and wait for response
    println!("  Approach A: Send getInfo, wait for getInfoResponse");
    send_json(
        &mm, 
        "urn:x-cast:com.spotify.chromecast.secure.v1", 
        sender_id, 
        &transport_id,
        json!({
            "type": "getInfo",
            "payload": {
                "remoteName": "SPX",
                "deviceID": "spx-test-123",
                "deviceAPI_isGroup": false,
            }
        })
    ).unwrap();
    println!("        📤 Sent getInfo (with payload wrapper)");

    let mut got_response = false;
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    let ns = msg.namespace.split(':').last().unwrap_or("?");
                    if msg.namespace.contains("spotify") {
                        println!("        📨 [{}] {}", ns, &payload[..payload.len().min(400)]);
                        if payload.contains("getInfoResponse") || payload.contains("status") {
                            got_response = true;
                        }
                    }
                }
            }
            Err(_) => {}
        }
    }

    if got_response {
        println!("        ✅ Got response!\n");
    } else {
        println!("        ❌ No response in 10s\n");

        // Approach 2: Try flat getInfo (no payload wrapper)
        println!("  Approach B: Send getInfo (flat format)");
        send_json(
            &mm, 
            "urn:x-cast:com.spotify.chromecast.secure.v1", 
            sender_id, 
            &transport_id,
            json!({
                "type": "getInfo",
                "remoteName": "SPX",
                "deviceID": "spx-test-123",
                "version": "2.1.0",
                "deviceAPI_isGroup": false,
            })
        ).unwrap();
        println!("        📤 Sent getInfo (flat)");

        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(10) {
            match mm.receive() {
                Ok(msg) => {
                    if let CastMessagePayload::String(payload) = &msg.payload {
                        let ns = msg.namespace.split(':').last().unwrap_or("?");
                        if msg.namespace.contains("spotify") {
                            println!("        📨 [{}] {}", ns, &payload[..payload.len().min(400)]);
                            if payload.contains("getInfoResponse") || payload.contains("status") {
                                got_response = true;
                            }
                        }
                    }
                }
                Err(_) => {}
            }
        }

        if got_response {
            println!("        ✅ Got response!\n");
        } else {
            println!("        ❌ No response\n");

            // Approach 3: Send addUser directly without handshake
            println!("  Approach C: Send addUser directly");
            send_json(
                &mm, 
                "urn:x-cast:com.spotify.chromecast.secure.v1", 
                sender_id, 
                &transport_id,
                json!({
                    "type": "addUser",
                    "payload": {
                        "blob": token,
                        "tokenType": "accesstoken",
                    }
                })
            ).unwrap();
            println!("        📤 Sent addUser");

            let start = Instant::now();
            while start.elapsed() < Duration::from_secs(10) {
                match mm.receive() {
                    Ok(msg) => {
                        if let CastMessagePayload::String(payload) = &msg.payload {
                            let ns = msg.namespace.split(':').last().unwrap_or("?");
                            if msg.namespace.contains("spotify") {
                                println!("        📨 [{}] {}", ns, &payload[..payload.len().min(400)]);
                                if payload.contains("getInfoResponse") || payload.contains("status") {
                                    got_response = true;
                                }
                            }
                        }
                    }
                    Err(_) => {}
                }
            }

            if got_response {
                println!("        ✅ Got response!\n");
            } else {
                println!("        ❌ No response\n");

                // Approach 4: Try different namespace
                println!("  Approach D: Try namespace v1 (not secure)");
                send_json(
                    &mm, 
                    "urn:x-cast:com.spotify.chromecast.v1", 
                    sender_id, 
                    &transport_id,
                    json!({
                        "type": "getInfo",
                        "version": "2.1.0",
                    })
                ).unwrap();
                println!("        📤 Sent getInfo on v1 namespace");

                let start = Instant::now();
                while start.elapsed() < Duration::from_secs(10) {
                    match mm.receive() {
                        Ok(msg) => {
                            if let CastMessagePayload::String(payload) = &msg.payload {
                                let ns = msg.namespace.split(':').last().unwrap_or("?");
                                if msg.namespace.contains("spotify") {
                                    println!("        📨 [{}] {}", ns, &payload[..payload.len().min(400)]);
                                    if payload.contains("getInfoResponse") || payload.contains("status") {
                                        got_response = true;
                                    }
                                }
                            }
                        }
                        Err(_) => {}
                    }
                }

                if got_response {
                    println!("        ✅ Got response!\n");
                } else {
                    println!("        ❌ No response\n");
                }
            }
        }
    }

    if got_response {
        println!("\n✅ SUCCESS: Device responded to auth!");
        println!("   Now checking if device appears in Spotify API...");
        
        // Wait a bit and tell user to check
        println!("   Waiting 10 seconds for device to register...");
        std::thread::sleep(Duration::from_secs(10));
        println!("   ✅ Done. Check your Spotify app/API for the device.");
    } else {
        println!("\n❌ FAILED: Device did not respond to any auth approach.");
        println!("   Possible reasons:");
        println!("   - Device requires a different auth protocol");
        println!("   - Token format is wrong (needs blob encryption?)");
        println!("   - Device needs to be activated via official app first");
        println!("   - Network/firewall blocking communication");
    }

    println!("\nDone.");
}
