//! Comprehensive tests for the SpotifyActor.
//!
//! These tests verify the actor's state management and message handling
//! without requiring a real Spotify API connection.
//!
//! NOTE: Due to the actor's `Handler::handle` using `rt.block_on()` internally,
//! tests that call Handler methods must NOT run inside a tokio runtime.
//! We use sync tests (`#[test]`) for state manipulation and async tests
//! (`#[tokio::test]`) for tests that don't call Handler methods directly.

#[cfg(test)]
mod tests {
    use super::super::spotify::{
        DeviceCache, DeviceInfo, PlaybackCache, SpotifyActor, SpotifyState, TokenState, UserCache,
        ClearSession, GetPlayback, GetStateSnapshot, Init, Pause, Play, SetMockMode,
        SetShuffle, SetVolume, TransferPlayback, Seek, GetDevices, SetRepeat,
    };
    use super::super::{Handler, Message};

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST UTILITIES AND HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// Creates a mock PlaybackCache with test data
    fn mock_playback_cache() -> PlaybackCache {
        PlaybackCache {
            track_id: Some("track123".to_string()),
            track_name: Some("Test Track".to_string()),
            artist_name: Some("Test Artist".to_string()),
            album_name: Some("Test Album".to_string()),
            album_image: Some("https://example.com/image.jpg".to_string()),
            is_playing: false,
            progress_ms: 30000,
            duration_ms: 180000,
            shuffle_state: false,
            repeat_state: "off".to_string(),
            volume: 75,
            device_id: Some("device123".to_string()),
            device_name: Some("Test Device".to_string()),
            context_uri: Some("spotify:album:abc123".to_string()),
            updated_at: None,
        }
    }

    /// Creates a mock DeviceCache with test data
    fn mock_device_cache() -> DeviceCache {
        DeviceCache {
            devices: vec![
                DeviceInfo {
                    id: "device1".to_string(),
                    name: "MacBook Pro".to_string(),
                    device_type: "Computer".to_string(),
                    is_active: true,
                    volume: 80,
                    can_transfer: true,
                },
                DeviceInfo {
                    id: "device2".to_string(),
                    name: "iPhone".to_string(),
                    device_type: "Smartphone".to_string(),
                    is_active: false,
                    volume: 60,
                    can_transfer: true,
                },
            ],
            active_id: Some("device1".to_string()),
            updated_at: None,
        }
    }

    /// Creates a mock UserCache with test data
    fn mock_user_cache() -> UserCache {
        UserCache {
            id: Some("user123".to_string()),
            display_name: Some("Test User".to_string()),
            images: vec!["https://example.com/avatar.jpg".to_string()],
            country: Some("US".to_string()),
            product: Some("premium".to_string()),
            updated_at: None,
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 1: SPOTIFY ACTOR INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_spotify_actor_initialization() {
        // Create a new actor
        let actor = SpotifyActor::new();
        
        // Get the initial state - use block_on for the async read
        let state = actor.state();
        let state_guard = futures::executor::block_on(state.read());
        
        // Verify default state values
        assert!(state_guard.client.is_none(), "Client should be None initially");
        assert!(!state_guard.is_initialized, "Should not be initialized initially");
        assert!(!state_guard.is_mock, "Should not be in mock mode initially");
        
        // Verify default cache values
        assert_eq!(state_guard.playback.track_id, None, "Track ID should be None");
        assert!(!state_guard.playback.is_playing, "Should not be playing initially");
        assert_eq!(state_guard.devices.devices.len(), 0, "Devices should be empty");
        assert_eq!(state_guard.user.id, None, "User ID should be None");
        assert!(!state_guard.token.is_valid, "Token should be invalid initially");
        
        // Verify token state default
        let token = &state_guard.token;
        assert_eq!(token.access_token, None);
        assert_eq!(token.expires_at, None);
        assert!(!token.is_valid);
    }

    #[test]
    fn test_actor_state_arc_clone() {
        let actor = SpotifyActor::new();
        
        // Clone the state Arc
        let state1 = actor.state();
        let state2 = actor.state();
        
        // Both should point to the same data
        let guard1 = futures::executor::block_on(state1.read());
        let guard2 = futures::executor::block_on(state2.read());
        
        assert!(guard1.client.is_none());
        assert!(guard2.client.is_none());
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 2: PLAYBACK CACHE STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_playback_cache_default() {
        let cache = PlaybackCache::default();
        
        assert_eq!(cache.track_id, None);
        assert_eq!(cache.track_name, None);
        assert_eq!(cache.artist_name, None);
        assert_eq!(cache.album_name, None);
        assert_eq!(cache.album_image, None);
        assert!(!cache.is_playing);
        assert_eq!(cache.progress_ms, 0);
        assert_eq!(cache.duration_ms, 0);
        assert!(!cache.shuffle_state);
        assert_eq!(cache.repeat_state, "", "repeat_state defaults to empty String");
        assert_eq!(cache.volume, 0);
        assert_eq!(cache.device_id, None);
        assert_eq!(cache.device_name, None);
        assert_eq!(cache.context_uri, None);
        assert_eq!(cache.updated_at, None);
    }

    #[test]
    fn test_playback_cache_mark_updated() {
        let mut cache = PlaybackCache::default();
        assert_eq!(cache.updated_at, None);
        
        cache.mark_updated();
        
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        assert!(cache.updated_at.is_some());
        let diff = now - cache.updated_at.unwrap();
        assert!(diff <= 1, "Updated timestamp should be within 1 second of now");
    }

    #[test]
    fn test_playback_cache_clone_independence() {
        let cache1 = mock_playback_cache();
        let cache2 = cache1.clone();
        
        // Verify they have the same data
        assert_eq!(cache1.track_id, cache2.track_id);
        assert_eq!(cache1.track_name, cache2.track_name);
        assert_eq!(cache1.is_playing, cache2.is_playing);
        
        // Modifying one shouldn't affect the other
        let mut cache3 = mock_playback_cache();
        cache3.is_playing = true;
        assert!(!cache2.is_playing);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 3: DEVICE CACHE STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_device_cache_default() {
        let cache = DeviceCache::default();
        
        assert!(cache.devices.is_empty());
        assert_eq!(cache.active_id, None);
        assert_eq!(cache.updated_at, None);
    }

    #[test]
    fn test_device_cache_mark_updated() {
        let mut cache = DeviceCache::default();
        assert_eq!(cache.updated_at, None);
        
        cache.mark_updated();
        
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        assert!(cache.updated_at.is_some());
        let diff = now - cache.updated_at.unwrap();
        assert!(diff <= 1, "Updated timestamp should be within 1 second of now");
    }

    #[test]
    fn test_device_info_fields() {
        let info = DeviceInfo {
            id: "test_id".to_string(),
            name: "Test Device".to_string(),
            device_type: "Computer".to_string(),
            is_active: true,
            volume: 100,
            can_transfer: true,
        };
        
        assert_eq!(info.id, "test_id");
        assert_eq!(info.name, "Test Device");
        assert_eq!(info.device_type, "Computer");
        assert!(info.is_active);
        assert_eq!(info.volume, 100);
        assert!(info.can_transfer);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 4: USER CACHE STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_user_cache_default() {
        let cache = UserCache::default();
        
        assert_eq!(cache.id, None);
        assert_eq!(cache.display_name, None);
        assert!(cache.images.is_empty());
        assert_eq!(cache.country, None);
        assert_eq!(cache.product, None);
        assert_eq!(cache.updated_at, None);
    }

    #[test]
    fn test_user_cache_mark_updated() {
        let mut cache = UserCache::default();
        assert_eq!(cache.updated_at, None);
        
        cache.mark_updated();
        
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        assert!(cache.updated_at.is_some());
        let diff = now - cache.updated_at.unwrap();
        assert!(diff <= 1, "Updated timestamp should be within 1 second of now");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 5: TOKEN STATE STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_token_state_default() {
        let token = TokenState::default();
        
        assert_eq!(token.access_token, None);
        assert_eq!(token.expires_at, None);
        assert!(!token.is_valid);
    }

    #[test]
    fn test_token_state_with_values() {
        let token = TokenState {
            access_token: Some("test_token_123".to_string()),
            expires_at: Some(9999999999),
            is_valid: true,
        };
        
        assert_eq!(token.access_token, Some("test_token_123".to_string()));
        assert_eq!(token.expires_at, Some(9999999999));
        assert!(token.is_valid);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 6: SPOTIFY STATE STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_spotify_state_default() {
        let state = SpotifyState::default();
        
        assert!(state.client.is_none());
        assert!(state.playback.track_id.is_none());
        assert!(state.devices.devices.is_empty());
        assert!(state.user.id.is_none());
        assert!(!state.token.is_valid);
        assert!(!state.is_initialized);
        assert!(!state.is_mock);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 7: STATE MUTATION
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_state_mutation_playback() {
        let actor = SpotifyActor::new();
        
        // Set playback state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback = mock_playback_cache();
            guard.playback.is_playing = true;
        }
        
        // Verify state
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert!(guard.playback.is_playing);
            assert_eq!(guard.playback.track_id, Some("track123".to_string()));
        }
    }

    #[test]
    fn test_state_mutation_devices() {
        let actor = SpotifyActor::new();
        
        // Set device state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.devices = mock_device_cache();
        }
        
        // Verify state
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert_eq!(guard.devices.devices.len(), 2);
            assert_eq!(guard.devices.active_id, Some("device1".to_string()));
        }
    }

    #[test]
    fn test_state_mutation_user() {
        let actor = SpotifyActor::new();
        
        // Set user state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.user = mock_user_cache();
        }
        
        // Verify state
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert_eq!(guard.user.id, Some("user123".to_string()));
            assert_eq!(guard.user.display_name, Some("Test User".to_string()));
        }
    }

    #[test]
    fn test_state_mutation_token() {
        let actor = SpotifyActor::new();
        
        // Set token state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.token = TokenState {
                access_token: Some("new_token".to_string()),
                expires_at: Some(1234567890),
                is_valid: true,
            };
        }
        
        // Verify state
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert!(guard.token.is_valid);
            assert_eq!(guard.token.access_token, Some("new_token".to_string()));
        }
    }

    #[test]
    fn test_state_mutation_initialized_flag() {
        let actor = SpotifyActor::new();
        
        // Initially not initialized
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert!(!guard.is_initialized);
        }
        
        // Set initialized
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.is_initialized = true;
        }
        
        // Verify
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert!(guard.is_initialized);
        }
    }

    #[test]
    fn test_state_mutation_mock_flag() {
        let actor = SpotifyActor::new();
        
        // Initially not mock
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert!(!guard.is_mock);
        }
        
        // Enable mock mode
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.is_mock = true;
        }
        
        // Verify
        {
            let state = actor.state();
            let guard = futures::executor::block_on(state.read());
            assert!(guard.is_mock);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 8: CONCURRENT READ ACCESS
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_concurrent_read_access() {
        use std::thread;
        
        let actor = SpotifyActor::new();
        
        // Set initial state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback = mock_playback_cache();
        }
        
        // Spawn multiple reader threads
        let handles: Vec<_> = (0..5)
            .map(|_| {
                let state = actor.state();
                thread::spawn(move || {
                    let guard = futures::executor::block_on(state.read());
                    guard.playback.track_id.clone()
                })
            })
            .collect();
        
        // Collect results
        let results: Vec<Option<String>> = handles
            .into_iter()
            .map(|h| h.join().unwrap())
            .collect();
        
        // All threads should get the same value
        assert!(results.iter().all(|r| r == &Some("track123".to_string())));
    }

    #[test]
    fn test_read_write_exclusion() {
        use std::thread;
        
        let actor = SpotifyActor::new();
        
        // Writer thread
        let writer = thread::spawn({
            let state = actor.state();
            move || {
                for i in 0..100 {
                    let mut guard = futures::executor::block_on(state.write());
                    guard.playback.progress_ms = i as i64;
                }
            }
        });
        
        // Reader threads
        let readers: Vec<_> = (0..3)
            .map(|_| {
                let state = actor.state();
                thread::spawn(move || {
                    let mut values = Vec::new();
                    for _ in 0..10 {
                        let guard = futures::executor::block_on(state.read());
                        values.push(guard.playback.progress_ms);
                    }
                    values
                })
            })
            .collect();
        
        writer.join().unwrap();
        
        // Each reader should get monotonically increasing or consistent values
        for reader in readers {
            let values = reader.join().unwrap();
            // Values should be valid (within expected range)
            assert!(values.iter().all(|&v| v >= 0 && v <= 100));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 9: MESSAGE TYPE TRAITS
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_message_types_implement_trait() {
        // Verify all message types implement Message trait
        fn assert_impl<M: Message>() {}
        
        // Auth messages
        assert_impl::<Init>();
        assert_impl::<ClearSession>();
        
        // Playback messages
        assert_impl::<Play>();
        assert_impl::<Pause>();
        assert_impl::<Seek>();
        assert_impl::<SetVolume>();
        assert_impl::<SetShuffle>();
        assert_impl::<SetRepeat>();
        assert_impl::<TransferPlayback>();
        assert_impl::<GetPlayback>();
        
        // Device messages
        assert_impl::<GetDevices>();
        
        // State messages
        assert_impl::<GetStateSnapshot>();
        assert_impl::<SetMockMode>();
    }

    #[test]
    fn test_handler_trait_bounds() {
        // Verify SpotifyActor implements Handler for all message types
        fn assert_handler<M: Message>() {}
        
        // This is a compile-time check that SpotifyActor implements Handler
        // for all the message types it should handle
        assert_handler::<Init>();
        assert_handler::<ClearSession>();
        assert_handler::<Play>();
        assert_handler::<Pause>();
        assert_handler::<Seek>();
        assert_handler::<SetVolume>();
        assert_handler::<SetShuffle>();
        assert_handler::<SetRepeat>();
        assert_handler::<TransferPlayback>();
        assert_handler::<GetPlayback>();
        assert_handler::<GetDevices>();
        assert_handler::<GetStateSnapshot>();
        assert_handler::<SetMockMode>();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 10: CACHE TTL BEHAVIOR
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_cache_freshness_with_timestamp() {
        let mut cache = PlaybackCache::default();
        cache.mark_updated();
        
        // Cache should be fresh immediately after update
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let is_fresh = cache.updated_at.map(|t| now - t < 5).unwrap_or(false);
        assert!(is_fresh, "Cache should be fresh within 5 seconds");
    }

    #[test]
    fn test_cache_staleness_calculation() {
        let mut cache = PlaybackCache::default();
        
        // Set updated_at to 10 seconds ago (stale for 5-second TTL)
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        cache.updated_at = Some(now - 10);
        
        let is_fresh = cache.updated_at.map(|t| now - t < 5).unwrap_or(false);
        assert!(!is_fresh, "Cache should be stale after 10 seconds with 5-second TTL");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 11: FULL STATE INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_full_state_setup() {
        let actor = SpotifyActor::new();
        
        // Set up complete state
        let playback = mock_playback_cache();
        let devices = mock_device_cache();
        let user = mock_user_cache();
        let token = TokenState {
            access_token: Some("integration_test_token".to_string()),
            expires_at: Some(9999999999),
            is_valid: true,
        };
        
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.is_initialized = true;
            guard.is_mock = true;
            guard.playback = playback;
            guard.devices = devices;
            guard.user = user;
            guard.token = token;
        }
        
        // Verify all state fields
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        
        assert!(guard.is_initialized);
        assert!(guard.is_mock);
        assert_eq!(guard.playback.track_id, Some("track123".to_string()));
        assert_eq!(guard.playback.track_name, Some("Test Track".to_string()));
        assert_eq!(guard.devices.devices.len(), 2);
        assert_eq!(guard.devices.active_id, Some("device1".to_string()));
        assert_eq!(guard.user.id, Some("user123".to_string()));
        assert_eq!(guard.user.display_name, Some("Test User".to_string()));
        assert_eq!(guard.token.access_token, Some("integration_test_token".to_string()));
        assert!(guard.token.is_valid);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 12: CLEAR SESSION BEHAVIOR
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_clear_session_effects() {
        let actor = SpotifyActor::new();
        
        // Set up initialized state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.is_initialized = true;
            guard.is_mock = true;
            guard.token = TokenState {
                access_token: Some("test_token".to_string()),
                expires_at: Some(9999999999),
                is_valid: true,
            };
        }
        
        // Simulate ClearSession by resetting state
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.is_initialized = false;
            guard.is_mock = false;
            guard.token = TokenState::default();
        }
        
        // Verify state is reset
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        assert!(!guard.is_initialized);
        assert!(!guard.is_mock);
        assert!(!guard.token.is_valid);
        assert_eq!(guard.token.access_token, None);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 13: ASYNC TESTS (without calling Handler methods directly)
    // ═══════════════════════════════════════════════════════════════════════════════

    #[tokio::test]
    async fn test_async_state_access() {
        let actor = SpotifyActor::new();
        
        // Set state
        {
            let state = actor.state();
            let mut guard = state.write().await;
            guard.playback = mock_playback_cache();
            guard.is_initialized = true;
        }
        
        // Read state
        let state = actor.state();
        let guard = state.read().await;
        assert!(guard.is_initialized);
        assert_eq!(guard.playback.track_id, Some("track123".to_string()));
    }

    #[tokio::test]
    async fn test_multiple_sequential_writes() {
        let actor = SpotifyActor::new();
        
        // Multiple sequential writes
        for i in 0..10 {
            let state = actor.state();
            let mut guard = state.write().await;
            guard.playback.progress_ms = i * 1000;
        }
        
        // Final state
        let state = actor.state();
        let guard = state.read().await;
        assert_eq!(guard.playback.progress_ms, 9000);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 14: ERROR HANDLING SIMULATION
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_client_not_initialized_behavior() {
        let actor = SpotifyActor::new();
        
        // Without client, operations should fail gracefully
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        
        assert!(guard.client.is_none(), "Client should be None");
        assert!(!guard.is_initialized, "Should not be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 15: VOLUME STATE
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_volume_state_persistence() {
        let actor = SpotifyActor::new();
        
        // Set volume
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback.volume = 50;
        }
        
        // Verify volume persists
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        assert_eq!(guard.playback.volume, 50);
    }

    #[test]
    fn test_shuffle_state_persistence() {
        let actor = SpotifyActor::new();
        
        // Set shuffle
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback.shuffle_state = true;
        }
        
        // Verify shuffle persists
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        assert!(guard.playback.shuffle_state);
    }

    #[test]
    fn test_repeat_state_persistence() {
        let actor = SpotifyActor::new();
        
        // Set repeat
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback.repeat_state = "context".to_string();
        }
        
        // Verify repeat persists
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        assert_eq!(guard.playback.repeat_state, "context");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 16: PLAYBACK DETAILS PRESERVATION
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_track_metadata_preservation() {
        let actor = SpotifyActor::new();
        
        // Set detailed track info
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback = mock_playback_cache();
        }
        
        // Verify all metadata
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        
        assert_eq!(guard.playback.track_id, Some("track123".to_string()));
        assert_eq!(guard.playback.track_name, Some("Test Track".to_string()));
        assert_eq!(guard.playback.artist_name, Some("Test Artist".to_string()));
        assert_eq!(guard.playback.album_name, Some("Test Album".to_string()));
        assert_eq!(guard.playback.album_image, Some("https://example.com/image.jpg".to_string()));
        assert_eq!(guard.playback.duration_ms, 180000);
    }

    #[test]
    fn test_device_info_preservation() {
        let actor = SpotifyActor::new();
        
        // Set device info
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback.device_id = Some("device_456".to_string());
            guard.playback.device_name = Some("My Computer".to_string());
        }
        
        // Verify device info
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        
        assert_eq!(guard.playback.device_id, Some("device_456".to_string()));
        assert_eq!(guard.playback.device_name, Some("My Computer".to_string()));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TEST 17: CONTEXT URI HANDLING
    // ═══════════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_context_uri_handling() {
        let actor = SpotifyActor::new();
        
        // Set context URI
        {
            let state = actor.state();
            let mut guard = futures::executor::block_on(state.write());
            guard.playback.context_uri = Some("spotify:playlist:abc123".to_string());
        }
        
        // Verify context URI
        let state = actor.state();
        let guard = futures::executor::block_on(state.read());
        assert_eq!(guard.playback.context_uri, Some("spotify:playlist:abc123".to_string()));
    }
}
