import XCTest
@testable import SPX

// MARK: - TrackInfoDecodingTests

final class TrackInfoDecodingTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullTrackInfo() throws {
        let json = Data("""
        {
            "id": "track123",
            "name": "Test Track",
            "artist": "Test Artist",
            "artistIds": ["artist1", "artist2"],
            "album": "Test Album",
            "durationMs": 180000,
            "progressMs": 60000,
            "isPlaying": true,
            "imageUrl": "https://example.com/cover.jpg",
            "uri": "spotify:track:track123"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.id, "track123")
        XCTAssertEqual(track.name, "Test Track")
        XCTAssertEqual(track.artist, "Test Artist")
        XCTAssertEqual(track.artistIds, ["artist1", "artist2"])
        XCTAssertEqual(track.album, "Test Album")
        XCTAssertEqual(track.durationMs, 180000)
        XCTAssertEqual(track.progressMs, 60000)
        XCTAssertEqual(track.isPlaying, true)
        XCTAssertEqual(track.imageUrl, "https://example.com/cover.jpg")
        XCTAssertEqual(track.uri, "spotify:track:track123")
    }

    func testDecodingTrackInfoWithAllFields() throws {
        let json = Data("""
        {
            "id": "fullTrack",
            "name": "Full Track Info",
            "artist": "Multiple Artists",
            "artistIds": ["a1", "a2", "a3"],
            "album": "Full Album",
            "durationMs": 300000,
            "progressMs": 150000,
            "isPlaying": false,
            "imageUrl": "https://example.com/fullcover.png",
            "uri": "spotify:track:fullTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.id, "fullTrack")
        XCTAssertEqual(track.name, "Full Track Info")
        XCTAssertEqual(track.artist, "Multiple Artists")
        XCTAssertEqual(track.artistIds?.count, 3)
        XCTAssertEqual(track.album, "Full Album")
        XCTAssertEqual(track.durationMs, 300000)
        XCTAssertEqual(track.progressMs, 150000)
        XCTAssertEqual(track.isPlaying, false)
        XCTAssertEqual(track.imageUrl, "https://example.com/fullcover.png")
        XCTAssertEqual(track.uri, "spotify:track:fullTrack")
    }

    // MARK: - Minimal JSON Decoding Tests

    func testDecodingMinimalTrackInfo() throws {
        let json = Data("""
        {
            "id": "minimal",
            "name": "Min",
            "artist": "Art",
            "album": "Alb",
            "durationMs": 1000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:minimal"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.id, "minimal")
        XCTAssertEqual(track.name, "Min")
        XCTAssertEqual(track.artist, "Art")
        XCTAssertEqual(track.album, "Alb")
        XCTAssertEqual(track.durationMs, 1000)
        XCTAssertEqual(track.progressMs, 0)
        XCTAssertEqual(track.isPlaying, false)
        XCTAssertNil(track.artistIds)
        XCTAssertNil(track.imageUrl)
        XCTAssertEqual(track.uri, "spotify:track:minimal")
    }

    // MARK: - Optional Fields Tests

    func testDecodingTrackInfoWithNullArtistIds() throws {
        let json = Data("""
        {
            "id": "noArtistIds",
            "name": "No Artist IDs",
            "artist": "Solo Artist",
            "album": "Album",
            "durationMs": 200000,
            "progressMs": 0,
            "isPlaying": true,
            "artistIds": null,
            "imageUrl": null,
            "uri": "spotify:track:noArtistIds"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNil(track.artistIds)
        XCTAssertNil(track.imageUrl)
    }

    func testDecodingTrackInfoWithEmptyArtistIds() throws {
        let json = Data("""
        {
            "id": "emptyArtists",
            "name": "Empty Artists",
            "artist": "Unknown",
            "artistIds": [],
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 90000,
            "isPlaying": true,
            "uri": "spotify:track:emptyArtists"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNotNil(track.artistIds)
        XCTAssertTrue(track.artistIds?.isEmpty ?? false)
    }

    func testDecodingTrackInfoWithSingleArtistId() throws {
        let json = Data("""
        {
            "id": "singleArtist",
            "name": "Single Artist Track",
            "artist": "The Artist",
            "artistIds": ["onlyArtist"],
            "album": "Album",
            "durationMs": 240000,
            "progressMs": 120000,
            "isPlaying": false,
            "uri": "spotify:track:singleArtist"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNotNil(track.artistIds)
        XCTAssertEqual(track.artistIds?.count, 1)
        XCTAssertEqual(track.artistIds?[0], "onlyArtist")
    }

    func testDecodingTrackInfoWithManyArtistIds() throws {
        let json = Data("""
        {
            "id": "manyArtists",
            "name": "Collaboration",
            "artist": "Various Artists",
            "artistIds": ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"],
            "album": "Compilation",
            "durationMs": 360000,
            "progressMs": 0,
            "isPlaying": true,
            "uri": "spotify:track:manyArtists"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNotNil(track.artistIds)
        XCTAssertEqual(track.artistIds?.count, 10)
    }
}
