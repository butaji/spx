use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};

static PROGRESS: AtomicU64 = AtomicU64::new(34000);
static IS_PLAYING: AtomicBool = AtomicBool::new(true);
static VOLUME: AtomicU32 = AtomicU32::new(74);
static SHUFFLE: AtomicBool = AtomicBool::new(true);
static REPEAT: AtomicU32 = AtomicU32::new(0); // 0=off, 1=context, 2=track

pub fn is_mock() -> bool {
    std::env::var("SPX_MOCK").is_ok_and(|v| v == "1" || v == "true")
}

fn track_json() -> Value {
    json!({
        "id": "mock_track_001",
        "name": "Open Hearts",
        "duration_ms": 200000,
        "explicit": false,
        "artists": [
            { "id": "mock_artist_001", "name": "The Weeknd" }
        ],
        "album": {
            "id": "mock_album_001",
            "name": "Hurry Up Tomorrow",
            "images": [
                { "url": "https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44", "height": 640, "width": 640 }
            ]
        },
        "uri": "spotify:track:mock_track_001"
    })
}

pub fn playback_state() -> Value {
    let progress = PROGRESS.load(Ordering::Relaxed);
    let playing = IS_PLAYING.load(Ordering::Relaxed);
    if playing {
        PROGRESS.store(progress.saturating_add(2000).min(200000), Ordering::Relaxed);
    }

    let repeat_state = match REPEAT.load(Ordering::Relaxed) {
        1 => "context",
        2 => "track",
        _ => "off",
    };

    json!({
        "is_playing": playing,
        "progress_ms": progress,
        "shuffle_state": SHUFFLE.load(Ordering::Relaxed),
        "repeat_state": repeat_state,
        "device": {
            "id": "mock_device_01",
            "name": "SPX-Mock",
            "volume_percent": VOLUME.load(Ordering::Relaxed),
            "is_active": true,
            "type": "Computer"
        },
        "item": track_json()
    })
}

pub fn playlists() -> Value {
    json!({
        "items": [
            { "id": "pl_1", "name": "Misery Sessions", "tracks": { "total": 42 }, "images": [], "uri": "spotify:playlist:pl_1", "owner": { "display_name": "user" } },
            { "id": "pl_2", "name": "Night Drive", "tracks": { "total": 88 }, "images": [], "uri": "spotify:playlist:pl_2", "owner": { "display_name": "user" } },
            { "id": "pl_3", "name": "Synthwave Essentials", "tracks": { "total": 120 }, "images": [], "uri": "spotify:playlist:pl_3", "owner": { "display_name": "user" } },
            { "id": "pl_4", "name": "Dark Ambient", "tracks": { "total": 34 }, "images": [], "uri": "spotify:playlist:pl_4", "owner": { "display_name": "user" } },
            { "id": "pl_5", "name": "Vaporwave Mix", "tracks": { "total": 56 }, "images": [], "uri": "spotify:playlist:pl_5", "owner": { "display_name": "user" } },
        ],
        "total": 5
    })
}

pub fn search(query: &str) -> Value {
    let q = query.to_lowercase();
    json!({
        "playlists": {
            "items": [
                { "id": "search_1", "name": format!("Results for '{}'", q), "tracks": { "total": 12 }, "images": [], "uri": "spotify:playlist:search_1", "owner": { "display_name": "user" } },
                { "id": "search_2", "name": format!("More '{}'", q), "tracks": { "total": 24 }, "images": [], "uri": "spotify:playlist:search_2", "owner": { "display_name": "user" } },
            ]
        },
        "tracks": {
            "items": [
                {
                    "id": "t1",
                    "name": "Neon Nights",
                    "duration_ms": 234000,
                    "artists": [{ "id": "a1", "name": "Cyberpunk Orchestra" }],
                    "album": { "id": "al1", "name": "Digital Dreams", "images": [{"url":"https://i.scdn.co/image/ab67616d0000b273000000000000000000000001","height":300,"width":300}] },
                    "uri": "spotify:track:t1"
                },
                {
                    "id": "t2",
                    "name": "Midnight Run",
                    "duration_ms": 198000,
                    "artists": [{ "id": "a2", "name": "Retro Wave" }],
                    "album": { "id": "al2", "name": "1984", "images": [{"url":"https://i.scdn.co/image/ab67616d0000b273000000000000000000000002","height":300,"width":300}] },
                    "uri": "spotify:track:t2"
                }
            ]
        },
        "albums": {
            "items": [
                { "id": "al1", "name": "Digital Dreams", "artists": [{"id":"a1","name":"Cyberpunk Orchestra"}], "images": [{"url":"https://i.scdn.co/image/ab67616d0000b273000000000000000000000001","height":300,"width":300}] }
            ]
        },
        "artists": {
            "items": [
                { "id": "a1", "name": "Cyberpunk Orchestra", "images": [{"url":"https://i.scdn.co/image/ab67616d0000b273000000000000000000000001","height":300,"width":300}] }
            ]
        }
    })
}

pub fn queue() -> Value {
    json!({
        "currently_playing": track_json(),
        "queue": [
            {
                "id": "mock_q_1",
                "name": "After Hours",
                "duration_ms": 361000,
                "artists": [{"id":"mock_artist_001","name":"The Weeknd"}],
                "album": {"id":"mock_album_002","name":"After Hours","images":[{"url":"https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44","height":640,"width":640}]},
                "uri": "spotify:track:mock_q_1"
            },
            {
                "id": "mock_q_2",
                "name": "Blinding Lights",
                "duration_ms": 200000,
                "artists": [{"id":"mock_artist_001","name":"The Weeknd"}],
                "album": {"id":"mock_album_002","name":"After Hours","images":[]},
                "uri": "spotify:track:mock_q_2"
            }
        ]
    })
}

pub fn devices() -> Value {
    json!({
        "devices": [
            { "id": "mock_device_01", "name": "SPX-Mock", "volume_percent": VOLUME.load(Ordering::Relaxed), "is_active": true, "type": "Computer" },
            { "id": "mock_device_02", "name": "Living Room Speaker", "volume_percent": 50, "is_active": false, "type": "Speaker" },
            { "id": "mock_device_03", "name": "iPhone", "volume_percent": 80, "is_active": false, "type": "Smartphone" },
        ]
    })
}

pub fn user_profile() -> Value {
    json!({
        "id": "mock_user",
        "display_name": "Mock User",
        "email": "mock@spx.local",
        "images": [{"url":"https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44","height":64,"width":64}],
        "followers": { "total": 1337 }
    })
}

pub fn saved_tracks() -> Value {
    json!({
        "items": [
            { "track": track_json(), "added_at": "2024-01-01T00:00:00Z" },
            { "track": { "id": "t1", "name": "Neon Nights", "duration_ms": 234000, "artists": [{"id":"a1","name":"Cyberpunk Orchestra"}], "album": {"id":"al1","name":"Digital Dreams","images":[]}, "uri": "spotify:track:t1" }, "added_at": "2024-01-02T00:00:00Z" }
        ],
        "total": 2
    })
}

pub fn saved_albums() -> Value {
    json!({
        "items": [
            { "album": { "id": "mock_album_001", "name": "Hurry Up Tomorrow", "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "images": [{"url":"https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44","height":640,"width":640}], "uri": "spotify:album:mock_album_001" } }
        ],
        "total": 1
    })
}

pub fn featured_playlists() -> Value {
    json!({
        "playlists": {
            "items": [
                { "id": "feat_1", "name": "Today's Top Hits", "tracks": { "total": 50 }, "images": [{"url":"https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44","height":300,"width":300}], "uri": "spotify:playlist:feat_1", "owner": { "display_name": "Spotify" } },
                { "id": "feat_2", "name": "RapCaviar", "tracks": { "total": 60 }, "images": [], "uri": "spotify:playlist:feat_2", "owner": { "display_name": "Spotify" } },
                { "id": "feat_3", "name": "Global Top 50", "tracks": { "total": 50 }, "images": [], "uri": "spotify:playlist:feat_3", "owner": { "display_name": "Spotify" } },
            ]
        }
    })
}

pub fn categories() -> Value {
    json!({
        "categories": {
            "items": [
                { "id": "cat_1", "name": "Pop", "icons": [{"url":"","height":64,"width":64}] },
                { "id": "cat_2", "name": "Hip-Hop", "icons": [{"url":"","height":64,"width":64}] },
                { "id": "cat_3", "name": "Rock", "icons": [{"url":"","height":64,"width":64}] },
                { "id": "cat_4", "name": "Electronic", "icons": [{"url":"","height":64,"width":64}] },
                { "id": "cat_5", "name": "Jazz", "icons": [{"url":"","height":64,"width":64}] },
            ]
        }
    })
}

pub fn album(album_id: &str) -> Value {
    json!({
        "id": album_id,
        "name": "Hurry Up Tomorrow",
        "artists": [{"id":"mock_artist_001","name":"The Weeknd"}],
        "images": [{"url":"https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44","height":640,"width":640}],
        "tracks": {
            "items": [
                { "id": "mock_track_001", "name": "Open Hearts", "duration_ms": 200000, "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "uri": "spotify:track:mock_track_001", "track_number": 1 },
                { "id": "mock_q_1", "name": "After Hours", "duration_ms": 361000, "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "uri": "spotify:track:mock_q_1", "track_number": 2 },
                { "id": "mock_q_2", "name": "Blinding Lights", "duration_ms": 200000, "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "uri": "spotify:track:mock_q_2", "track_number": 3 }
            ]
        },
        "uri": format!("spotify:album:{}", album_id)
    })
}

pub fn artist(artist_id: &str) -> Value {
    json!({
        "id": artist_id,
        "name": "The Weeknd",
        "images": [{"url":"https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44","height":640,"width":640}],
        "genres": ["canadian pop", "r&b"],
        "followers": { "total": 50000000 },
        "uri": format!("spotify:artist:{}", artist_id)
    })
}

pub fn artist_top_tracks(_artist_id: &str) -> Value {
    json!({
        "tracks": [
            { "id": "mock_q_2", "name": "Blinding Lights", "duration_ms": 200000, "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "album": {"id":"mock_album_002","name":"After Hours","images":[]}, "uri": "spotify:track:mock_q_2" },
            { "id": "mock_q_1", "name": "After Hours", "duration_ms": 361000, "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "album": {"id":"mock_album_002","name":"After Hours","images":[]}, "uri": "spotify:track:mock_q_1" },
            { "id": "mock_track_001", "name": "Open Hearts", "duration_ms": 200000, "artists": [{"id":"mock_artist_001","name":"The Weeknd"}], "album": {"id":"mock_album_001","name":"Hurry Up Tomorrow","images":[]}, "uri": "spotify:track:mock_track_001" }
        ]
    })
}

pub fn playlist_tracks(playlist_id: &str) -> Value {
    json!({
        "items": [
            { "track": track_json(), "added_at": "2024-01-01T00:00:00Z", "added_by": {"id":"user","display_name":"user"} }
        ],
        "total": 1,
        "uri": format!("spotify:playlist:{}", playlist_id)
    })
}

pub fn playlist(playlist_id: &str) -> Value {
    json!({
        "id": playlist_id,
        "name": "Mock Playlist",
        "description": "A mock playlist for testing",
        "tracks": { "total": 42 },
        "images": [
            { "url": "https://i.scdn.co/image/ab67616d0000b2734f0fd9dad638cb6d7c710c44", "height": 640, "width": 640 }
        ],
        "uri": format!("spotify:playlist:{}", playlist_id),
        "owner": { "display_name": "Mock User" }
    })
}

pub fn play() { IS_PLAYING.store(true, Ordering::Relaxed); }
pub fn pause() { IS_PLAYING.store(false, Ordering::Relaxed); }
pub fn next() { PROGRESS.store(0, Ordering::Relaxed); }
pub fn previous() { PROGRESS.store(0, Ordering::Relaxed); }
pub fn seek(_position_ms: u32) { PROGRESS.store(_position_ms as u64, Ordering::Relaxed); }
pub fn set_volume(vol: u8) { VOLUME.store(vol as u32, Ordering::Relaxed); }
pub fn set_shuffle(state: bool) { SHUFFLE.store(state, Ordering::Relaxed); }
pub fn set_repeat(state: &str) {
    let val = match state { "track" => 2, "context" => 1, _ => 0 };
    REPEAT.store(val, Ordering::Relaxed);
}
