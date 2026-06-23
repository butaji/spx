use rust_cast::message_manager::{CastMessage, CastMessagePayload, MessageManager};
use rustls::pki_types::ServerName;
use rustls::StreamOwned;
use rustls::{ClientConfig, ClientConnection};
use serde_json::json;
use std::net::TcpStream;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{debug, info};

// NOTE: This verifier intentionally disables TLS certificate validation and is
// used ONLY for connecting to local Google Cast devices on the LAN. Cast
// devices present self-signed certificates that cannot be validated through
// normal PKI. It must never be used for remote/public hosts.
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

/// Authenticate a Cast device using multiple protocol approaches
pub fn authenticate_cast_device_raw(ip: &str, token: &str) -> Result<String, String> {
    info!("Starting raw Cast auth for {}", ip);

    // Install crypto provider
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

    let config = ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoCertificateVerification))
        .with_no_client_auth();

    let server_name = ServerName::try_from(ip)
        .map_err(|e| format!("Invalid IP: {}", e))?
        .to_owned();

    let conn = ClientConnection::new(Arc::new(config), server_name)
        .map_err(|e| format!("TLS config error: {}", e))?;

    let stream = TcpStream::connect((ip, 8009)).map_err(|e| format!("TCP connect error: {}", e))?;

    let tls_stream = StreamOwned::new(conn, stream);
    let mm = MessageManager::new(tls_stream);
    let sender_id = "sender-0";

    // 1. CONNECT to receiver-0
    info!("Sending CONNECT to receiver-0");
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
        }),
    )?;

    // 2. Send initial PING
    send_json(
        &mm,
        "urn:x-cast:com.google.cast.tp.heartbeat",
        sender_id,
        "receiver-0",
        json!({"type": "PING"}),
    )?;

    // 3. LAUNCH Spotify
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
        }),
    )?;

    // 4. Wait for RECEIVER_STATUS with transportId
    info!("Waiting for RECEIVER_STATUS...");
    let mut transport_id = String::new();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        if let Ok(msg) = mm.receive() {
            if let CastMessagePayload::String(payload) = &msg.payload {
                debug!("Received: {}", payload);
                if payload.contains("RECEIVER_STATUS") {
                    if let Ok(status) = serde_json::from_str::<serde_json::Value>(payload) {
                        if let Some(apps) = status.get("status").and_then(|s| s.get("applications"))
                        {
                            if let Some(app_array) = apps.as_array() {
                                for app in app_array {
                                    if app.get("appId").and_then(|a| a.as_str()) == Some("CC32E753")
                                    {
                                        transport_id = app
                                            .get("transportId")
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
        }),
    )?;

    // 6. Try auth approaches
    info!("Trying auth approaches...");

    // Approach 1: Send getInfo with payload wrapper
    info!("Approach 1: getInfo with payload wrapper");
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
        }),
    )?;

    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        if let Ok(msg) = mm.receive() {
            if let CastMessagePayload::String(payload) = &msg.payload {
                if msg.namespace.contains("spotify") {
                    debug!("Spotify message: {}", payload);
                    if payload.contains("getInfoResponse") || payload.contains("status") {
                        info!("Got response: {}", payload);
                        // Send addUser
                        return send_add_user(&mm, sender_id, &transport_id, token);
                    }
                }
            }
        }
    }

    // Approach 2: Send flat getInfo
    info!("Approach 2: getInfo flat format");
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
        }),
    )?;

    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(10) {
        if let Ok(msg) = mm.receive() {
            if let CastMessagePayload::String(payload) = &msg.payload {
                if msg.namespace.contains("spotify") {
                    debug!("Spotify message: {}", payload);
                    if payload.contains("getInfoResponse") || payload.contains("status") {
                        info!("Got response: {}", payload);
                        return send_add_user(&mm, sender_id, &transport_id, token);
                    }
                }
            }
        }
    }

    // Approach 3: Send addUser directly
    info!("Approach 3: addUser directly");
    send_add_user(&mm, sender_id, &transport_id, token)
}

fn send_add_user(
    mm: &MessageManager<StreamOwned<ClientConnection, TcpStream>>,
    sender_id: &str,
    transport_id: &str,
    token: &str,
) -> Result<String, String> {
    info!("Sending addUser with token");
    send_json(
        mm,
        "urn:x-cast:com.spotify.chromecast.secure.v1",
        sender_id,
        transport_id,
        json!({
            "type": "addUser",
            "payload": {
                "blob": token,
                "tokenType": "accesstoken",
            }
        }),
    )?;

    // Wait for confirmation
    info!("Waiting for auth confirmation...");
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(15) {
        if let Ok(msg) = mm.receive() {
            if let CastMessagePayload::String(payload) = &msg.payload {
                if msg.namespace.contains("spotify") {
                    info!("Auth response: {}", payload);
                    if payload.contains("ok")
                        || payload.contains("success")
                        || payload.contains("status")
                    {
                        return Ok("Device authenticated successfully".to_string());
                    }
                    if payload.contains("error") {
                        return Err(format!("Auth error: {}", payload));
                    }
                }
            }
        }
    }

    // If no specific error, assume it worked (device might not send confirmation)
    info!("No explicit confirmation, but no error either");
    Ok("Auth sent (no confirmation received)".to_string())
}

fn send_json(
    mm: &MessageManager<StreamOwned<ClientConnection, TcpStream>>,
    namespace: &str,
    source: &str,
    dest: &str,
    payload: serde_json::Value,
) -> Result<(), String> {
    mm.send(CastMessage {
        namespace: namespace.to_string(),
        source: source.to_string(),
        destination: dest.to_string(),
        payload: CastMessagePayload::String(payload.to_string()),
    })
    .map_err(|e| format!("Send error: {}", e))
}
