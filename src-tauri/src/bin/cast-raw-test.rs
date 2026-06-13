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

fn send_json(mm: &MessageManager<StreamOwned<ClientConnection, TcpStream>>, namespace: &str, source: &str, dest: &str, payload: serde_json::Value) {
    mm.send(CastMessage {
        namespace: namespace.to_string(),
        source: source.to_string(),
        destination: dest.to_string(),
        payload: CastMessagePayload::String(payload.to_string()),
    }).unwrap();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        println!("Usage: cargo run --bin cast-raw-test -- <IP> <ACCESS_TOKEN>");
        return;
    }

    let ip = &args[1];
    let token = &args[2];

    println!("Raw Cast Protocol Test");
    println!("======================\n");

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

    println!("✅ TLS connected to {}:8009\n", ip);

    let mm = MessageManager::new(tls_stream);
    let sender_id = "sender-0";

    // 1. CONNECT to receiver-0 with Spotify userAgent
    println!("1. Sending CONNECT to receiver-0...");
    send_json(&mm, "urn:x-cast:com.google.cast.tp.connection", sender_id, "receiver-0",
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
    );
    println!("   ✅ CONNECT sent\n");

    // 2. Send PING
    println!("2. Sending PING...");
    send_json(&mm, "urn:x-cast:com.google.cast.tp.heartbeat", sender_id, "receiver-0",
        json!({"type": "PING"})
    );

    // 3. Listen for PONG and any messages
    println!("3. Listening for 3 seconds...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(3) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    println!("   📨 [{}] {}", msg.namespace.split(':').last().unwrap_or("?"), payload);
                }
            }
            Err(_) => {}
        }
    }

    // 4. LAUNCH Spotify app
    println!("\n4. Launching Spotify app (CC32E753)...");
    send_json(&mm, "urn:x-cast:com.google.cast.receiver", sender_id, "receiver-0",
        json!({
            "type": "LAUNCH",
            "appId": "CC32E753",
            "requestId": 1
        })
    );
    println!("   ✅ LAUNCH sent\n");

    // 5. Wait for RECEIVER_STATUS with app info
    println!("5. Waiting for RECEIVER_STATUS...");
    let mut transport_id = String::new();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    if payload.contains("RECEIVER_STATUS") {
                        println!("   📊 RECEIVER_STATUS: {}", &payload[..payload.len().min(500)]);
                        
                        // Extract transportId
                        if let Ok(status) = serde_json::from_str::<serde_json::Value>(payload) {
                            if let Some(apps) = status.get("status").and_then(|s| s.get("applications")) {
                                if let Some(app_array) = apps.as_array() {
                                    for app in app_array {
                                        if app.get("appId").and_then(|a| a.as_str()) == Some("CC32E753") {
                                            transport_id = app.get("transportId").and_then(|t| t.as_str()).unwrap_or("").to_string();
                                            println!("   ✅ Found Spotify app, transportId={}", transport_id);
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
            Err(_) => {}
        }
    }

    if transport_id.is_empty() {
        println!("   ❌ No Spotify app transportId found");
        return;
    }

    // 6. CONNECT to app transport
    println!("\n6. Sending CONNECT to transport {}...", transport_id);
    send_json(
        &mm, "urn:x-cast:com.google.cast.tp.connection", sender_id, &transport_id,
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
    );
    println!("   ✅ App CONNECT sent\n");

    // 7. Listen for getInfoResponse
    println!("7. Listening for getInfoResponse (20 seconds)...");
    let start = Instant::now();
    let mut got_response = false;
    while start.elapsed() < Duration::from_secs(20) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    let ns = msg.namespace.split(':').last().unwrap_or("?");
                    println!("   📨 [{}] {}", ns, &payload[..payload.len().min(300)]);

                    if payload.contains("getInfoResponse") {
                        println!("\n   🎉 GOT getInfoResponse!");
                        got_response = true;

                        // Send token
                        println!("   📤 Sending addUser with token...");
                        send_json(
                            &mm, "urn:x-cast:com.spotify.chromecast.secure.v1", sender_id, &transport_id,
                            json!({
                                "type": "addUser",
                                "payload": {
                                    "blob": token,
                                    "tokenType": "accesstoken",
                                }
                            })
                        );
                        println!("   ✅ Token sent\n");

                        // Continue listening for more responses
                        println!("   Listening for 10 more seconds...");
                        let start2 = Instant::now();
                        while start2.elapsed() < Duration::from_secs(10) {
                            match mm.receive() {
                                Ok(msg2) => {
                                    if let CastMessagePayload::String(p2) = &msg2.payload {
                                        println!("   📨 [{}] {}", 
                                            msg2.namespace.split(':').last().unwrap_or("?"),
                                            &p2[..p2.len().min(300)]);
                                    }
                                }
                                Err(_) => {}
                            }
                        }
                        break;
                    }
                }
            }
            Err(e) => {
                if !e.to_string().contains("TimedOut") {
                    println!("   ⚠️  Error: {}", e);
                }
            }
        }
    }

    if !got_response {
        println!("\n❌ No getInfoResponse received");
        println!("   Try: check if device needs different auth format");
    }

    println!("\nDone.");
}
