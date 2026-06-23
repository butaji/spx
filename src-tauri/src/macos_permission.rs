#![allow(unexpected_cfgs)]

use objc::runtime::{Class, Object};
use objc::{msg_send, sel, sel_impl};
use std::ffi::CString;

/// Trigger macOS local network permission dialog
/// This uses NSProcessInfo to access the local network description
pub fn request_local_network_permission() {
    unsafe {
        let ns_process_info = Class::get("NSProcessInfo").unwrap();
        let info: *mut Object = msg_send![ns_process_info, processInfo];
        let _: () = msg_send![info, processName];
    }

    // Make a local network call to trigger the permission dialog
    // Using CFNetServiceBrowser which will trigger NSLocalNetworkUsageDescription
    unsafe {
        let cf_string = |s: &str| {
            let c_str = CString::new(s).unwrap();
            let cf_string: *mut Object = msg_send![
                Class::get("NSString").unwrap(),
                stringWithUTF8String: c_str.as_ptr()
            ];
            cf_string
        };

        // Create a browser for _googlecast._tcp
        let service_type = cf_string("_googlecast._tcp");
        let domain = cf_string("local.");

        let ns_net_service_browser = Class::get("NSNetServiceBrowser").unwrap();
        let browser: *mut Object = msg_send![ns_net_service_browser, alloc];
        let browser: *mut Object = msg_send![browser, init];

        // This will trigger the local network permission dialog
        let _: () = msg_send![
            browser,
            searchForServicesOfType: service_type
            inDomain: domain
        ];

        // Stop immediately after triggering the dialog
        let _: () = msg_send![browser, stop];
        let _: () = msg_send![browser, release];
    }
}
