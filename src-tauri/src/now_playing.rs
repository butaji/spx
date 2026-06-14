//! macOS Now Playing Info Center integration.
//!
//! Publishes SPX's playback state to the macOS Control Center so users can see
//! track info, artwork, and control playback from the system UI.
//!
//! Uses the MediaPlayer framework via Objective-C FFI.

use objc::runtime::{Class, Object};
use objc::{msg_send, sel, sel_impl};
use std::ffi::CString;
use tracing::{debug, info, warn};

/// Track info for Now Playing
#[derive(Debug, Clone, Default)]
pub struct TrackInfo {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub artwork_data: Option<Vec<u8>>,
    pub duration_ms: Option<i64>,
    pub elapsed_ms: Option<i64>,
    pub is_playing: bool,
}

impl TrackInfo {
    /// Create a new TrackInfo
    pub fn new(
        title: &str,
        artist: &str,
        album: &str,
        duration_ms: i64,
        elapsed_ms: i64,
        is_playing: bool,
    ) -> Self {
        Self {
            title: Some(title.to_string()),
            artist: Some(artist.to_string()),
            album: Some(album.to_string()),
            duration_ms: Some(duration_ms),
            elapsed_ms: Some(elapsed_ms),
            is_playing,
            artwork_data: None,
        }
    }

    /// Set artwork from image data
    pub fn with_artwork(mut self, data: Vec<u8>) -> Self {
        self.artwork_data = Some(data);
        self
    }
}

/// Create an NSString from a Rust string
unsafe fn nsstring(s: &str) -> *mut Object {
    let c_str = CString::new(s).unwrap();
    msg_send![Class::get("NSString").unwrap(), stringWithUTF8String: c_str.as_ptr()]
}

/// Create an NSNumber from an f64
unsafe fn nsnumber_f64(val: f64) -> *mut Object {
    msg_send![Class::get("NSNumber").unwrap(), numberWithDouble: val]
}

/// Now Playing Info Center manager for macOS
pub struct NowPlayingCenter {
    /// Whether initialization succeeded
    initialized: bool,
}

impl NowPlayingCenter {
    /// Create a new NowPlayingCenter
    pub fn new() -> Self {
        // Check if MediaPlayer framework classes are available
        let available = Class::get("MPNowPlayingInfoCenter").is_some();
        if available {
            info!("MPNowPlayingInfoCenter is available");
        } else {
            warn!("MPNowPlayingInfoCenter is not available");
        }
        Self { initialized: available }
    }

    /// Check if Now Playing is available
    pub fn is_available(&self) -> bool {
        self.initialized
    }

    /// Update the Now Playing info with track details
    pub fn update(&self, info: &TrackInfo) {
        if !self.initialized {
            debug!("Now Playing not available, skipping update");
            return;
        }

        unsafe {
            // Get the default Now Playing Info Center
            let center_class = Class::get("MPNowPlayingInfoCenter").unwrap();
            let center: *mut Object = msg_send![center_class, defaultCenter];
            
            // Build the info dictionary using NSMutableDictionary
            let dict_class = Class::get("NSMutableDictionary").unwrap();
            let dict: *mut Object = msg_send![dict_class, dictionary];
            
            // Set title
            if let Some(title) = &info.title {
                let key = nsstring("MPMediaItemPropertyTitle");
                let value = nsstring(title);
                let _: () = msg_send![dict, setObject: value forKey: key];
            }

            // Set artist
            if let Some(artist) = &info.artist {
                let key = nsstring("MPMediaItemPropertyArtist");
                let value = nsstring(artist);
                let _: () = msg_send![dict, setObject: value forKey: key];
            }

            // Set album
            if let Some(album) = &info.album {
                let key = nsstring("MPMediaItemPropertyAlbumTitle");
                let value = nsstring(album);
                let _: () = msg_send![dict, setObject: value forKey: key];
            }

            // Set duration (convert ms to seconds)
            if let Some(duration_ms) = info.duration_ms {
                let duration_secs = duration_ms as f64 / 1000.0;
                let key = nsstring("MPMediaItemPropertyPlaybackDuration");
                let value = nsnumber_f64(duration_secs);
                let _: () = msg_send![dict, setObject: value forKey: key];
            }

            // Set elapsed time (convert ms to seconds)
            let elapsed_secs = info.elapsed_ms.unwrap_or(0) as f64 / 1000.0;
            let key = nsstring("MPNowPlayingInfoPropertyElapsedPlaybackTime");
            let value = nsnumber_f64(elapsed_secs);
            let _: () = msg_send![dict, setObject: value forKey: key];

            // Set playback rate (1.0 = playing, 0.0 = paused)
            let rate = if info.is_playing { 1.0 } else { 0.0 };
            let key = nsstring("MPNowPlayingInfoPropertyPlaybackRate");
            let value = nsnumber_f64(rate);
            let _: () = msg_send![dict, setObject: value forKey: key];

            // Set the now playing info
            let _: () = msg_send![center, setNowPlayingInfo: dict];

            debug!("Updated Now Playing: {:?}", info.title);
        }
    }

    /// Clear the Now Playing info (no track playing)
    pub fn clear(&self) {
        if !self.initialized {
            return;
        }

        unsafe {
            let center_class = Class::get("MPNowPlayingInfoCenter").unwrap();
            let center: *mut Object = msg_send![center_class, defaultCenter];
            let nil: *const Object = std::ptr::null();
            let _: () = msg_send![center, setNowPlayingInfo: nil];
            debug!("Cleared Now Playing info");
        }
    }

    /// Update only the playback state (for quick play/pause updates)
    pub fn set_playing(&self, is_playing: bool, elapsed_ms: i64) {
        if !self.initialized {
            return;
        }

        unsafe {
            let center_class = Class::get("MPNowPlayingInfoCenter").unwrap();
            let center: *mut Object = msg_send![center_class, defaultCenter];
            
            // Get current info
            let current_info: Option<*mut Object> = msg_send![center, nowPlayingInfo];
            
            if let Some(info) = current_info {
                // Create mutable copy
                let dict: *mut Object = msg_send![info, mutableCopy];
                
                // Update elapsed time
                let elapsed_secs = elapsed_ms as f64 / 1000.0;
                let key = nsstring("MPNowPlayingInfoPropertyElapsedPlaybackTime");
                let value = nsnumber_f64(elapsed_secs);
                let _: () = msg_send![dict, setObject: value forKey: key];
                
                // Update rate
                let rate = if is_playing { 1.0 } else { 0.0 };
                let key = nsstring("MPNowPlayingInfoPropertyPlaybackRate");
                let value = nsnumber_f64(rate);
                let _: () = msg_send![dict, setObject: value forKey: key];
                
                // Set back
                let _: () = msg_send![center, setNowPlayingInfo: dict];
            }
        }
    }
}

impl Default for NowPlayingCenter {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Global state ─────────────────────────────────────────────────────────────

use std::sync::OnceLock;
static NOW_PLAYING: OnceLock<NowPlayingCenter> = OnceLock::new();

fn get_now_playing() -> &'static NowPlayingCenter {
    NOW_PLAYING.get_or_init(NowPlayingCenter::new)
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn update_now_playing(
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration_ms: Option<i64>,
    elapsed_ms: Option<i64>,
    is_playing: bool,
) {
    let info = TrackInfo {
        title,
        artist,
        album,
        duration_ms,
        elapsed_ms,
        is_playing,
        artwork_data: None,
    };
    
    get_now_playing().update(&info);
}

#[tauri::command]
pub fn clear_now_playing() {
    get_now_playing().clear();
}
