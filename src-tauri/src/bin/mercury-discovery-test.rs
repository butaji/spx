use spx_lib::librespot_client::SpotifyConnectClient;
use protobuf::Message;
use futures_util::stream::StreamExt;
use std::time::Duration;

#[tokio::main]
async fn main() {
    println!("Active Mercury Device Discovery Test");
    println!("=====================================\n");

    let access_token = std::env::args().nth(1)
        .expect("Usage: cargo run --bin mercury-discovery-test -- <token>");

    println!("Token: {}...\n", &access_token[..20.min(access_token.len())]);

    // 1. Create session
    print!("1. Creating librespot session... ");
    let client = SpotifyConnectClient::new(&access_token, "test"
    ).await.expect("Failed to create session");
    println!("✅ Connected as: {}", client.username());

    // 2. Subscribe and send hello
    println!("\n2. Sending hello message to discover devices...");
    println!("   (Listening for 15 seconds...)\n");

    let username = client.username();
    let session = client.session;

    let uri = format!("hm://remote/user/{}/", urlencoding::encode(&username));
    println!("   URI: {}", uri);

    let mut devices = std::collections::HashMap::new();

    // Subscribe to mercury
    let subscription = session
        .mercury()
        .subscribe(uri.clone())
        .await
        .expect("Failed to subscribe");

    let mut stream = tokio_stream::wrappers::UnboundedReceiverStream::new(subscription);

    // Send hello message to trigger responses
    println!("\n   📤 Sending hello...");
    let hello_frame = create_hello_frame(
&session.device_id(), 
&username);
    let mut sender = session.mercury().sender(uri);
    
    sender.send(hello_frame.write_to_bytes().unwrap());
    match sender.flush().await {
        Ok(_) => println!("   ✅ Hello sent"),
        Err(e) => println!("   ❌ Hello failed: {:?}", e),
    }

    // Listen for responses
    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(15) {
        match tokio::time::timeout(Duration::from_secs(1), stream.next()).await {
            Ok(Some(response)) => {
                if let Some(data) = response.payload.first() {
                    match librespot_protocol::spirc::Frame::parse_from_bytes(data) {
                        Ok(frame) => {
                            let msg_type = frame.get_typ();
                            let device_name = frame.get_device_state().get_name().to_string();
                            let device_id = frame.get_ident().to_string();
                            let is_active = frame.get_device_state().get_is_active();
                            
                            if !device_name.is_empty() && device_name != "test" && device_name != "SPX Player" {
                                devices.insert(device_id.clone(), (device_name.clone(), is_active));
                                println!("   📱 [{}] {} (id={}) active={}", 
                                    format_message_type(msg_type),
                                    device_name, device_id, is_active);
                            } else if !device_name.is_empty() {
                                println!("   🔄 [{}] {} (id={}) active={}",
                                    format_message_type(msg_type),
                                    device_name, device_id, is_active);
                            }
                        }
                        Err(e) => {
                            println!("   ⚠️  Failed to parse frame: {}", e);
                        }
                    }
                }
            }
            Ok(None) => {
                break;
            }
            Err(_) => {
                // Timeout, continue
            }
        }
    }

    println!("\n3. Found {} unique device(s):", devices.len());
    for (id, (name, active)) in devices {
        println!("   - {} (id={}) active={}", name, id, active);
    }

    println!("\nDone.");
}

fn create_hello_frame(device_id: &str, username: &str) -> librespot_protocol::spirc::Frame {
    use librespot_protocol::spirc::{Frame, MessageType, DeviceState, CapabilityType};
    
    let mut frame = Frame::new();
    frame.set_ident(device_id.to_string());
    frame.set_typ(MessageType::kMessageTypeHello);
    
    let mut device = DeviceState::new();
    device.set_name("SPX Discovery".to_string());
    device.set_can_play(true);
    device.set_is_active(false);
    device.set_volume(65535);
    device.set_sw_version("1.0.0".to_string());
    
    // Add capabilities
    let caps = device.mut_capabilities();
    
    let mut cap1 = librespot_protocol::spirc::Capability::new();
    cap1.set_typ(CapabilityType::kCanBePlayer);
    cap1.mut_intValue().push(1);
    caps.push(cap1);
    
    let mut cap2 = librespot_protocol::spirc::Capability::new();
    cap2.set_typ(CapabilityType::kDeviceType);
    cap2.mut_intValue().push(5); // Computer
    caps.push(cap2);
    
    frame.set_device_state(device);
    
    frame
}

fn format_message_type(t: librespot_protocol::spirc::MessageType) -> String {
    match t {
        librespot_protocol::spirc::MessageType::kMessageTypeHello => "HELLO",
        librespot_protocol::spirc::MessageType::kMessageTypeNotify => "NOTIFY",
        librespot_protocol::spirc::MessageType::kMessageTypeLoad => "LOAD",
        librespot_protocol::spirc::MessageType::kMessageTypePlay => "PLAY",
        librespot_protocol::spirc::MessageType::kMessageTypePause => "PAUSE",
        librespot_protocol::spirc::MessageType::kMessageTypeSeek => "SEEK",
        _ => "OTHER",
    }.to_string()
}
