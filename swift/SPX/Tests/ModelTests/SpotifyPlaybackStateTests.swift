import XCTest
@testable import SPX

final class SpotifyPlaybackStateTests: XCTestCase {

    // MARK: - JSON Decoding Tests

    private var fullPlaybackStateJSON: Data {
        Data("""
        {
            "is_playing": true,
            "shuffle_state": false,
            "repeat_state": "context",
            "progress_ms": 45000,
            "timestamp": 1716200000000,
            "item": {
                "id": "currentTrack",
                "name": "Currently Playing",
                "uri": "spotify:track:currentTrack",
                "duration_ms": 210000,
                "track_number": 3,
                "disc_number": 1,
                "explicit": false,
                "popularity": 90
            },
            "device": {
                "id": "device123",
                "name": "MacBook Pro",
                "volume_percent": 75,
                "type": "Computer",
                "is_active": true,
                "is_private_session": false,
                "is_restricted": false,
                "supports_volume": true,
                "isLocal": false,
                "localNote": null,
                "canTransfer": true,
                "needsWakeUp": null,
                "deviceIp": "192.168.1.100"
            },
            "context": {
                "type": "album",
                "href": "https://api.spotify.com/v1/albums/album123",
                "external_urls": {
                    "spotify": "https://open.spotify.com/album/album123"
                },
                "uri": "spotify:album:album123"
            }
        }
        """.utf8)
    }

    private func assertFullPlaybackStateDecoded(_ state: SpotifyPlaybackState) {
        XCTAssertEqual(state.isPlaying, true)
        XCTAssertEqual(state.shuffleState, false)
        XCTAssertEqual(state.repeatState, .context)
        XCTAssertEqual(state.progressMs, 45000)
        XCTAssertEqual(state.timestamp, 1716200000000)
    }

    func testDecodingFullPlaybackState() throws {
        let state = try JSONDecoder().decode(SpotifyPlaybackState.self, from: fullPlaybackStateJSON)
        assertFullPlaybackStateDecoded(state)
    }

    func testDecodingMinimalPlaybackState() throws {
        let json = Data("""
        {
            "is_playing": false
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertEqual(state.isPlaying, false)
        XCTAssertNil(state.shuffleState)
        XCTAssertNil(state.repeatState)
        XCTAssertNil(state.progressMs)
        XCTAssertNil(state.item)
        XCTAssertNil(state.device)
        XCTAssertNil(state.timestamp)
        XCTAssertNil(state.context)
    }

    func testDecodingPlaybackStateWithNullOptionals() throws {
        let json = Data("""
        {
            "is_playing": null,
            "shuffle_state": null,
            "repeat_state": null,
            "progress_ms": null,
            "timestamp": null,
            "item": null,
            "device": null,
            "context": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNil(state.isPlaying)
        XCTAssertNil(state.shuffleState)
        XCTAssertNil(state.repeatState)
        XCTAssertNil(state.progressMs)
        XCTAssertNil(state.item)
        XCTAssertNil(state.device)
        XCTAssertNil(state.context)
    }

    // MARK: - Repeat State Tests

    func testDecodingRepeatStateOff() throws {
        let json = Data("""
        {
            "is_playing": true,
            "repeat_state": "off"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertEqual(state.repeatState, .off)
    }

    func testDecodingRepeatStateContext() throws {
        let json = Data("""
        {
            "is_playing": true,
            "repeat_state": "context"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertEqual(state.repeatState, .context)
    }

    func testDecodingRepeatStateTrack() throws {
        let json = Data("""
        {
            "is_playing": true,
            "repeat_state": "track"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertEqual(state.repeatState, .track)
    }

    // MARK: - Device Info Nested Decoding Tests

    func testDecodingFullDevice() throws {
        let json = Data("""
        {
            "device": {
                "id": "deviceFull",
                "name": "Full Device",
                "volume_percent": 80,
                "type": "Smartphone",
                "is_active": true,
                "is_private_session": false,
                "is_restricted": false,
                "supports_volume": true,
                "isLocal": false,
                "localNote": "Local note",
                "canTransfer": true,
                "needsWakeUp": false,
                "deviceIp": "10.0.0.1"
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.device)
        guard let device = state.device else {
            XCTFail("Expected device to be present")
            return
        }
        XCTAssertEqual(device.id, "deviceFull")
        XCTAssertEqual(device.name, "Full Device")
        XCTAssertEqual(device.volumePercent, 80)
        XCTAssertEqual(device.type, "Smartphone")
        XCTAssertEqual(device.isActive, true)
        XCTAssertEqual(device.isPrivateSession, false)
        XCTAssertEqual(device.isRestricted, false)
        XCTAssertEqual(device.supportsVolume, true)
        XCTAssertEqual(device.isLocal, false)
        XCTAssertEqual(device.localNote, "Local note")
        XCTAssertEqual(device.canTransfer, true)
        XCTAssertEqual(device.needsWakeUp, false)
        XCTAssertEqual(device.deviceIp, "10.0.0.1")
    }

    func testDecodingMinimalDevice() throws {
        let json = Data("""
        {
            "device": {
                "name": "Minimal Device"
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.device)
        XCTAssertEqual(state.device?.name, "Minimal Device")
        XCTAssertNil(state.device?.id)
        XCTAssertNil(state.device?.volumePercent)
        XCTAssertNil(state.device?.type)
        XCTAssertNil(state.device?.isActive)
    }

    func testDecodingDeviceWithAllNullOptionals() throws {
        let json = Data("""
        {
            "device": {
                "id": null,
                "name": null,
                "volume_percent": null,
                "type": null,
                "is_active": null,
                "is_private_session": null,
                "is_restricted": null,
                "supports_volume": null,
                "isLocal": null,
                "localNote": null,
                "canTransfer": null,
                "needsWakeUp": null,
                "deviceIp": null
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.device)
        XCTAssertNil(state.device?.id)
        XCTAssertNil(state.device?.name)
        XCTAssertNil(state.device?.volumePercent)
    }

    // MARK: - Context Decoding Tests

    func testDecodingFullContext() throws {
        let json = Data("""
        {
            "context": {
                "type": "playlist",
                "href": "https://api.spotify.com/v1/playlists/playlist123",
                "external_urls": {
                    "spotify": "https://open.spotify.com/playlist/playlist123"
                },
                "uri": "spotify:playlist:playlist123"
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.context)
        guard let context = state.context else {
            XCTFail("Expected context to be present")
            return
        }
        XCTAssertEqual(context.type, "playlist")
        XCTAssertEqual(context.href, "https://api.spotify.com/v1/playlists/playlist123")
        XCTAssertEqual(context.uri, "spotify:playlist:playlist123")
        XCTAssertNotNil(context.externalUrls)
        XCTAssertEqual(context.externalUrls?.spotify, "https://open.spotify.com/playlist/playlist123")
    }

    func testDecodingMinimalContext() throws {
        let json = Data("""
        {
            "context": {
                "type": "album"
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.context)
        XCTAssertEqual(state.context?.type, "album")
        XCTAssertNil(state.context?.href)
        XCTAssertNil(state.context?.uri)
        XCTAssertNil(state.context?.externalUrls)
    }

    func testDecodingContextWithNullExternalUrls() throws {
        let json = Data("""
        {
            "context": {
                "type": "artist",
                "external_urls": null
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.context)
        XCTAssertNil(state.context?.externalUrls)
    }

    func testDecodingContextWithVariousTypes() throws {
        let albumContext = Data("""
        {
            "context": {
                "type": "album",
                "uri": "spotify:album:album123"
            }
        }
        """.utf8)

        let artistContext = Data("""
        {
            "context": {
                "type": "artist",
                "uri": "spotify:artist:artist123"
            }
        }
        """.utf8)

        let playlistContext = Data("""
        {
            "context": {
                "type": "playlist",
                "uri": "spotify:playlist:playlist123"
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let albumState = try decoder.decode(SpotifyPlaybackState.self, from: albumContext)
        let artistState = try decoder.decode(SpotifyPlaybackState.self, from: artistContext)
        let playlistState = try decoder.decode(SpotifyPlaybackState.self, from: playlistContext)

        XCTAssertEqual(albumState.context?.type, "album")
        XCTAssertEqual(artistState.context?.type, "artist")
        XCTAssertEqual(playlistState.context?.type, "playlist")
    }

    // MARK: - Item Decoding Tests

    func testDecodingPlaybackStateWithItem() throws {
        let json = Data("""
        {
            "is_playing": true,
            "item": {
                "id": "playingTrack",
                "name": "Now Playing Track",
                "uri": "spotify:track:playingTrack",
                "duration_ms": 180000
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state = try decoder.decode(SpotifyPlaybackState.self, from: json)

        XCTAssertNotNil(state.item)
        XCTAssertEqual(state.item?.id, "playingTrack")
        XCTAssertEqual(state.item?.name, "Now Playing Track")
        XCTAssertEqual(state.item?.durationMs, 180000)
    }

    // MARK: - Equality and Hashable Tests

    func testPlaybackStateEquality() throws {
        let json1 = Data("""
        {
            "is_playing": true,
            "shuffle_state": false,
            "repeat_state": "off",
            "progress_ms": 30000
        }
        """.utf8)

        let json2 = Data("""
        {
            "is_playing": true,
            "shuffle_state": false,
            "repeat_state": "off",
            "progress_ms": 30000
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state1 = try decoder.decode(SpotifyPlaybackState.self, from: json1)
        let state2 = try decoder.decode(SpotifyPlaybackState.self, from: json2)

        XCTAssertEqual(state1, state2)
    }

    func testPlaybackStateInequality() throws {
        let json1 = Data("""
        {
            "is_playing": true
        }
        """.utf8)

        let json2 = Data("""
        {
            "is_playing": false
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state1 = try decoder.decode(SpotifyPlaybackState.self, from: json1)
        let state2 = try decoder.decode(SpotifyPlaybackState.self, from: json2)

        XCTAssertNotEqual(state1, state2)
    }

    func testContextEquality() throws {
        let json1 = Data("""
        {
            "type": "album",
            "href": "https://example.com",
            "uri": "spotify:album:123"
        }
        """.utf8)

        let json2 = Data("""
        {
            "type": "album",
            "href": "https://example.com",
            "uri": "spotify:album:123"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let context1 = try decoder.decode(Context.self, from: json1)
        let context2 = try decoder.decode(Context.self, from: json2)

        XCTAssertEqual(context1, context2)
    }

    func testPlaybackStateHashable() throws {
        let json1 = Data("""
        {
            "is_playing": true,
            "progress_ms": 10000
        }
        """.utf8)

        let json2 = Data("""
        {
            "is_playing": true,
            "progress_ms": 10000
        }
        """.utf8)

        let decoder = JSONDecoder()
        let state1 = try decoder.decode(SpotifyPlaybackState.self, from: json1)
        let state2 = try decoder.decode(SpotifyPlaybackState.self, from: json2)

        var hashSet = Set<SpotifyPlaybackState>()
        hashSet.insert(state1)
        hashSet.insert(state2)

        XCTAssertEqual(hashSet.count, 1)
    }
}
