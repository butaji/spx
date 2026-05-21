use rust_cast::message_manager::{CastMessage, CastMessagePayload, MessageManager};
use rustls::{ClientConfig, ClientConnection};
use rustls::pki_types::ServerName;
use serde_json::json;
use std::sync::Arc;
use std::time::{Duration, Instant};
use std::net::TcpStream;
use rustls::StreamOwned;
use tracing::{info, error, debug};

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

/// Authenticate a Cast device using the proper Spotify CONNECT protocol
/// 
/// This implementation sends the correct userAgent and senderInfo fields
/// that the Spotify Cast receiver app expects.
pub fn authenticate_cast_device_raw(
    ip: &str,
    token: &str,
) -> Result<String, String> {
    info!("Starting raw Cast auth for {}", ip);

    // Install crypto provider (idempotent)
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

    // Create TLS config
    let config = ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoCertificateVerification))
        .with_no_client_auth();

    let server_name = ServerName::try_from(ip)
        .map_err(|e| format!("Invalid IP: {}", e))?
        .to_owned();
    
    let conn = ClientConnection::new(Arc::new(config), server_name)
        .map_err(|e| format!("TLS config error: {}", e))?;
    
    let stream = TcpStream::connect((ip, 8009))
        .map_err(|e| format!("TCP connect error: {}", e))?;
    
    let tls_stream = StreamOwned::new(conn, stream);
    let mm = MessageManager::new(tls_stream);
    let sender_id = "sender-0";

    // 1. CONNECT to receiver-0 with Spotify userAgent
    info!("Sending CONNECT to receiver-0 with Spotify userAgent");
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
    )?;

    // 2. Send initial PING
    send_json(
        &mm, 
        "urn:x-cast:com.google.cast.tp.heartbeat", 
        sender_id, 
        "receiver-0",
        json!({"type": "PING"})
    )?;

    // 3. LAUNCH Spotify app
    info!("Launching Spotify app CC32E753");
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
    )?;

    // 4. Wait for RECEIVER_STATUS with transportId
    info!("Waiting for RECEIVER_STATUS...");
    let mut transport_id = String::new();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    debug!("Received: {}", payload);
                    if payload.contains("RECEIVER_STATUS") {
                        if let Ok(status) = serde_json::from_str::<serde_json::Value>(payload) {
                            if let Some(apps) = status.get("status").and_then(|s| s.get("applications")) {
                                if let Some(app_array) = apps.as_array() {
                                    for app in app_array {
                                        if app.get("appId").and_then(|a| a.as_str()) == Some("CC32E753") {
                                            transport_id = app.get("transportId")
                                                .and_then(|t| t.as_str())
                                                .unwrap_or("")
                                                .to_string();
                                            info!("Found Spotify app, transportId={}", transport_id);
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
        return Err("Spotify app did not start or no transportId received".to_string());
    }

    // 5. CONNECT to app transport
    info!("Sending CONNECT to transport {}", transport_id);
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
    )?;

    // 6. Listen for getInfoResponse
    info!("Listening for getInfoResponse...");
    let start = Instant::now();
    let mut got_response = false;
    while start.elapsed() < Duration::from_secs(20) {
        match mm.receive() {
            Ok(msg) => {
                if let CastMessagePayload::String(payload) = &msg.payload {
                    debug!("App message: {}", payload);
                    
                    if payload.contains("getInfoResponse") {
                        info!("Got getInfoResponse!");
                        got_response = true;

                        // Send token
                        info!("Sending addUser with token");
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
                        )?;
                        break;
                    }
                }
            }
            Err(e) => {
                if !e.to_string().contains("TimedOut") {
                    error!("Receive error: {}", e);
                }
            }
        }
    }

    if !got_response {
        return Err("No getInfoResponse received from device".to_string());
    }

    info!("Cast auth completed successfully");
    Ok("Device authenticated".to_string())
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
