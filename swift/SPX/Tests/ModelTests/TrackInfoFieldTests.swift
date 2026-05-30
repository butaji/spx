import XCTest
@testable import SPX

// MARK: - TrackInfoFieldTests

final class TrackInfoFieldTests: XCTestCase {

    // MARK: - ImageUrl Tests

    func testDecodingTrackInfoWithImageUrl() throws {
        let json = Data("""
        {
            "id": "withImage",
            "name": "With Image",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 60000,
            "isPlaying": true,
            "imageUrl": "https://i.scdn.co/image/ab67616d00001e02abc19b5051a2c5e3c1d28bb4",
            "uri": "spotify:track:withImage"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(
            track.imageUrl,
            "https://i.scdn.co/image/ab67616d00001e02abc19b5051a2c5e3c1d28bb4"
        )
    }

    func testDecodingTrackInfoWithNullImageUrl() throws {
        let json = Data("""
        {
            "id": "noImage",
            "name": "No Image",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "imageUrl": null,
            "uri": "spotify:track:noImage"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNil(track.imageUrl)
    }

    // MARK: - Progress and Duration Tests

    func testDecodingTrackInfoWithZeroProgress() throws {
        let json = Data("""
        {
            "id": "startTrack",
            "name": "Start",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:startTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 0)
        XCTAssertEqual(track.durationMs, 180000)
    }

    func testDecodingTrackInfoAtEnd() throws {
        let json = Data("""
        {
            "id": "endTrack",
            "name": "End",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 200000,
            "progressMs": 200000,
            "isPlaying": false,
            "uri": "spotify:track:endTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 200000)
        XCTAssertEqual(track.durationMs, 200000)
    }

    func testDecodingTrackInfoProgressGreaterThanDuration() throws {
        let json = Data("""
        {
            "id": "overProgress",
            "name": "Over Progress",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 200000,
            "isPlaying": true,
            "uri": "spotify:track:overProgress"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 200000)
        XCTAssertEqual(track.durationMs, 180000)
    }

    // MARK: - isPlaying State Tests

    func testDecodingTrackInfoPlaying() throws {
        let json = Data("""
        {
            "id": "playing",
            "name": "Now Playing",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 90000,
            "isPlaying": true,
            "uri": "spotify:track:playing"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.isPlaying, true)
    }

    func testDecodingTrackInfoPaused() throws {
        let json = Data("""
        {
            "id": "paused",
            "name": "Paused Track",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 45000,
            "isPlaying": false,
            "uri": "spotify:track:paused"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.isPlaying, false)
    }
}
