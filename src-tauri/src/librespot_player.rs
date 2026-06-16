//! Spotify Connect device built on librespot.
//!
//! Learns from `spotify-player`:
//!   - Use `librespot_oauth` to get a token accepted by Spotify access points.
//!   - Create a `librespot_core::Session` with `Credentials::with_access_token`.
//!   - Build a `librespot_connect::Spirc` device plus a `librespot_playback::Player`
//!     so SPX shows up as a Connect target and can play audio locally.

use std::sync::Arc;

use librespot_connect::{ConnectConfig, Spirc};
use librespot_core::{
    authentication::Credentials, cache::Cache, config::SessionConfig, Session,
};
use librespot_playback::{
    audio_backend::{self, Sink},
    config::{AudioFormat, PlayerConfig},
    mixer::{self, Mixer},
    player::Player,
};
use tokio::task::JoinHandle;
use tracing::{info, warn};

/// Handle to a running local Connect device.
pub struct ConnectDevice {
    /// librespot Spirc controller (can be used to send local commands).
    pub spirc: Spirc,
    /// Background task driving the Spirc event loop.
    pub task: JoinHandle<()>,
    /// Device ID assigned by librespot.
    pub device_id: String,
}

/// Query the user-visible macOS product version (e.g. "15.5.1" or "26.0").
#[cfg(target_os = "macos")]
pub fn macos_product_version() -> Option<String> {
    use std::ffi::{CStr, c_char};
    use std::ptr::null_mut;

    let mut len: libc::size_t = 0;
    let name = c"kern.osproductversion";
    unsafe {
        if libc::sysctlbyname(
            name.as_ptr() as *const c_char,
            null_mut(),
            &mut len,
            null_mut(),
            0,
        ) != 0
            || len == 0
        {
            return None;
        }
        let mut buf = vec![0u8; len];
        if libc::sysctlbyname(
            name.as_ptr() as *const c_char,
            buf.as_mut_ptr() as *mut libc::c_void,
            &mut len,
            null_mut(),
            0,
        ) != 0
        {
            return None;
        }
        CStr::from_bytes_with_nul(&buf)
            .ok()
            .and_then(|s| s.to_str().ok())
            .map(|s| s.to_string())
    }
}

/// Detect macOS versions that are known to crash inside CoreAudio when CPAL/
/// Rodio initialises the default output device. The crash is an OS-side memory
/// corruption issue in macOS 26 (Tahoe) that Apple has not yet shipped a fix
/// for. SPX Connect local audio is therefore gated on older/macOS versions or
/// when the user explicitly opts in via `SPX_FORCE_LIBRESPOT=1`.
#[cfg(target_os = "macos")]
fn is_affected_macos_version() -> bool {
    macos_product_version()
        .and_then(|v| v.split('.').next().and_then(|s| s.parse::<u32>().ok()))
        .map(|major| major >= 26)
        .unwrap_or(false)
}

/// Start a local Spotify Connect device using the provided access token.
///
/// The token must have the `streaming` scope and should be fresh (not expired).
/// Returns once the device has registered with Spotify's Connect cloud.
pub async fn start_connect_device(
    access_token: String,
    name: String,
    volume_percent: u16,
) -> Result<ConnectDevice, String> {
    #[cfg(target_os = "macos")]
    if is_affected_macos_version() && std::env::var("SPX_FORCE_LIBRESPOT").is_err() {
        warn!("SPX Connect local audio disabled on macOS 26+ to avoid a known CoreAudio crash");
        return Err(
            "SPX Connect local audio is temporarily unavailable on macOS 26 due to a known \
             CoreAudio issue. Please use SPX Player to play on this Mac, or set \
             SPX_FORCE_LIBRESPOT=1 to override."
                .to_string(),
        );
    }

    // 1. Authenticate a librespot session.
    let session_config = SessionConfig::default();
    let cache = Cache::new(None::<String>, None, None, None).map_err(|e| e.to_string())?;
    let session = Session::new(session_config, Some(cache));

    let credentials = Credentials::with_access_token(access_token);
    // NOTE: do not call session.connect() here. Spirc::new connects the
    // session itself after registering dealer listeners.

    // 2. Build Connect device config.
    let volume = ((volume_percent.min(100) as f64 / 100.0) * 65535.0).round() as u16;
    let connect_config = ConnectConfig {
        name,
        device_type: librespot_core::config::DeviceType::Speaker,
        initial_volume: volume,
        is_group: false,
        disable_volume: false,
        volume_steps: 64,
    };

    // 3. Build mixer + audio backend + player.
    let mixer: Arc<dyn Mixer> = Arc::new(
        mixer::softmixer::SoftMixer::open(librespot_playback::mixer::MixerConfig::default())
            .map_err(|e| format!("failed to open softmixer: {e}"))?,
    );
    mixer.set_volume(volume);

    let backend = audio_backend::find(None).ok_or("no audio backend available")?;

    let player_config = PlayerConfig {
        bitrate: librespot_playback::config::Bitrate::Bitrate320,
        ..Default::default()
    };

    let player = Player::new(
        player_config,
        session.clone(),
        mixer.get_soft_volume(),
        move || -> Box<dyn Sink> { backend(None, AudioFormat::default()) },
    );

    // 4. Start Spirc.
    info!("Starting local Spotify Connect device '{}'", connect_config.name);
    let (spirc, spirc_task) = Spirc::new(connect_config, session.clone(), credentials, player, mixer)
        .await
        .map_err(|e| format!("failed to initialize Spirc: {e}"))?;

    let task = tokio::spawn(async move {
        spirc_task.await;
        warn!("Spirc event loop ended");
    });

    let device_id = session.device_id().to_string();
    info!("Local Connect device ready with device_id={}", device_id);

    Ok(ConnectDevice {
        spirc,
        task,
        device_id,
    })
}
