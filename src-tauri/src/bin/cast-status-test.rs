use rustls::crypto::aws_lc_rs;
use std::time::Instant;

fn main() {
    aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install AWS-LC crypto provider");

    let devices = vec![
        ("Mini2", "192.168.1.14"),
        ("Living Room", "192.168.1.9"),
        ("Living Room2", "192.168.1.11"),
        ("Bedroom", "192.168.1.12"),
    ];

    for (name, ip) in devices {
        let start = Instant::now();
        print!("{} ({}): ", name, ip);
        match rust_cast::CastDevice::connect_without_host_verification(ip, 8009) {
            Ok(device) => {
                if let Err(e) = device.connection.connect("receiver-0") {
                    print!("CONNECT failed: {} | ", e);
                }
                match device.receiver.get_status() {
                    Ok(status) => {
                        if status.applications.is_empty() {
                            print!("No apps running");
                        } else {
                            for app in &status.applications {
                                print!("{} ({}) ", app.display_name, app.app_id);
                            }
                        }
                    }
                    Err(e) => print!("get_status failed: {}", e),
                }
            }
            Err(e) => print!("Connect failed: {}", e),
        }
        println!(" [{:?}]", start.elapsed());
    }
}
