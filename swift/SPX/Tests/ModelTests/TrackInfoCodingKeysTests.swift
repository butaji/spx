import XCTest
@testable import SPX

// MARK: - TrackInfoCodingKeysTests

final class TrackInfoCodingKeysTests: XCTestCase {

    // MARK: - CodingKeys Tests

    func testTrackInfoCodingKeysArtistIds() throws {
        let json = Data("""
        {
            "id": "codingKeys",
            "name": "Coding Keys Test",
            "artist": "Artist",
            "artistIds": ["id1", "id2"],
            "album": "Album",
            "durationMs": 100,
            "progressMs": 50,
            "isPlaying": true,
            "uri": "spotify:track:codingKeys"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.artistIds, ["id1", "id2"])
    }

    func testTrackInfoCodingKeysDurationMs() throws {
        let json = Data("""
        {
            "id": "durationTest",
            "name": "Duration",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 250000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:durationTest"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.durationMs, 250000)
    }

    func testTrackInfoCodingKeysProgressMs() throws {
        let json = Data("""
        {
            "id": "progressTest",
            "name": "Progress",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 300000,
            "progressMs": 123456,
            "isPlaying": true,
            "uri": "spotify:track:progressTest"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 123456)
    }

    func testTrackInfoCodingKeysIsPlaying() throws {
        let json = Data("""
        {
            "id": "playingTest",
            "name": "Playing Test",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 60000,
            "isPlaying": true,
            "uri": "spotify:track:playingTest"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.isPlaying, true)
    }

    func testTrackInfoCodingKeysImageUrl() throws {
        let json = Data("""
        {
            "id": "imageUrlTest",
            "name": "Image URL",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "imageUrl": "https://example.com/art.jpg",
            "uri": "spotify:track:imageUrlTest"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.imageUrl, "https://example.com/art.jpg")
    }
}
