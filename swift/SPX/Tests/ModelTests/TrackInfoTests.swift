import XCTest
@testable import SPX

final class TrackInfoTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullTrackInfo() throws {
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNil(track.artistIds)
        XCTAssertNil(track.imageUrl)
    }

    func testDecodingTrackInfoWithEmptyArtistIds() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNotNil(track.artistIds)
        XCTAssertTrue(track.artistIds?.isEmpty ?? false)
    }

    func testDecodingTrackInfoWithSingleArtistId() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNotNil(track.artistIds)
        XCTAssertEqual(track.artistIds?.count, 1)
        XCTAssertEqual(track.artistIds?[0], "onlyArtist")
    }

    func testDecodingTrackInfoWithManyArtistIds() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNotNil(track.artistIds)
        XCTAssertEqual(track.artistIds?.count, 10)
    }

    // MARK: - ImageUrl Tests

    func testDecodingTrackInfoWithImageUrl() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.imageUrl, "https://i.scdn.co/image/ab67616d00001e02abc19b5051a2c5e3c1d28bb4")
    }

    func testDecodingTrackInfoWithNullImageUrl() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertNil(track.imageUrl)
    }

    // MARK: - Progress and Duration Tests

    func testDecodingTrackInfoWithZeroProgress() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 0)
        XCTAssertEqual(track.durationMs, 180000)
    }

    func testDecodingTrackInfoAtEnd() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 200000)
        XCTAssertEqual(track.durationMs, 200000)
    }

    func testDecodingTrackInfoProgressGreaterThanDuration() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 200000)
        XCTAssertEqual(track.durationMs, 180000)
    }

    // MARK: - isPlaying State Tests

    func testDecodingTrackInfoPlaying() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.isPlaying, true)
    }

    func testDecodingTrackInfoPaused() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.isPlaying, false)
    }

    // MARK: - CodingKeys Tests

    func testTrackInfoCodingKeysArtistIds() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.artistIds, ["id1", "id2"])
    }

    func testTrackInfoCodingKeysDurationMs() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.durationMs, 250000)
    }

    func testTrackInfoCodingKeysProgressMs() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.progressMs, 123456)
    }

    func testTrackInfoCodingKeysIsPlaying() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.isPlaying, true)
    }

    func testTrackInfoCodingKeysImageUrl() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.imageUrl, "https://example.com/art.jpg")
    }

    // MARK: - Equality Tests

    func testTrackInfoEquality() throws {
        let json1 = """
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
        """.data(using: .utf8)!

        let json2 = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(TrackInfo.self, from: json1)
        let track2 = try decoder.decode(TrackInfo.self, from: json2)

        XCTAssertEqual(track1, track2)
    }

    func testTrackInfoInequality() throws {
        let json1 = """
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
        """.data(using: .utf8)!

        let json2 = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(TrackInfo.self, from: json1)
        let track2 = try decoder.decode(TrackInfo.self, from: json2)

        XCTAssertNotEqual(track1, track2)
    }

    // MARK: - Hashable Tests

    func testTrackInfoHashable() throws {
        let json1 = """
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
        """.data(using: .utf8)!

        let json2 = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(TrackInfo.self, from: json1)
        let track2 = try decoder.decode(TrackInfo.self, from: json2)

        var hashSet = Set<TrackInfo>()
        hashSet.insert(track1)
        hashSet.insert(track2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testTrackInfoHashableInDictionary() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        var dict = [TrackInfo: String]()
        dict[track] = "testValue"

        XCTAssertEqual(dict[track], "testValue")
    }

    // MARK: - Identifiable Tests

    func testTrackInfoIdentifiable() throws {
        let json = """
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
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(TrackInfo.self, from: json)

        XCTAssertEqual(track.id, "identifiableTrack")
    }
}
