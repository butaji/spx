import XCTest
@testable import SPX

// MARK: - TrackInfoEqualityTests

final class TrackInfoEqualityTests: XCTestCase {

    // MARK: - Equality Tests

    func testTrackInfoEquality() throws {
        let json1 = Data("""
        {
            "id": "equalTrack",
            "name": "Equal Track",
            "artist": "Artist",
            "artistIds": ["a1"],
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 60000,
            "isPlaying": true,
            "imageUrl": "https://example.com/img.jpg",
            "uri": "spotify:track:equalTrack"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "equalTrack",
            "name": "Equal Track",
            "artist": "Artist",
            "artistIds": ["a1"],
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 60000,
            "isPlaying": true,
            "imageUrl": "https://example.com/img.jpg",
            "uri": "spotify:track:equalTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(TrackInfo.self, from: json1)
        let track2 = try decoder.decode(TrackInfo.self, from: json2)

        XCTAssertEqual(track1, track2)
    }

    func testTrackInfoInequality() throws {
        let json1 = Data("""
        {
            "id": "trackA",
            "name": "Track A",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:trackA"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "trackB",
            "name": "Track B",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:trackB"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(TrackInfo.self, from: json1)
        let track2 = try decoder.decode(TrackInfo.self, from: json2)

        XCTAssertNotEqual(track1, track2)
    }

    // MARK: - Hashable Tests

    func testTrackInfoHashable() throws {
        let json1 = Data("""
        {
            "id": "hashTrack",
            "name": "Hash Track",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 90000,
            "isPlaying": true,
            "uri": "spotify:track:hashTrack"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "hashTrack",
            "name": "Hash Track",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 90000,
            "isPlaying": true,
            "uri": "spotify:track:hashTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(TrackInfo.self, from: json1)
        let track2 = try decoder.decode(TrackInfo.self, from: json2)

        var hashSet = Set<TrackInfo>()
        hashSet.insert(track1)
        hashSet.insert(track2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testTrackInfoHashableInDictionary() throws {
        let json = Data("""
        {
            "id": "dictTrack",
            "name": "Dictionary Track",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:dictTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        var dict = [TrackInfo: String]()
        dict[track] = "testValue"

        XCTAssertEqual(dict[track], "testValue")
    }

    // MARK: - Identifiable Tests

    func testTrackInfoIdentifiable() throws {
        let json = Data("""
        {
            "id": "identifiableTrack",
            "name": "Identifiable",
            "artist": "Artist",
            "album": "Album",
            "durationMs": 180000,
            "progressMs": 0,
            "isPlaying": false,
            "uri": "spotify:track:identifiableTrack"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.id, "identifiableTrack")
    }
}
