import XCTest
@testable import SPX

final class SpotifyTrackTests: XCTestCase {

    // MARK: - JSON Decoding Tests

    func testDecodingFullTrack() throws {
        let json = """
        {
            "id": "track123",
            "name": "Test Track",
            "uri": "spotify:track:track123",
            "duration_ms": 210000,
            "track_number": 5,
            "disc_number": 1,
            "explicit": true,
            "popularity": 85,
            "preview_url": "https://p.scdn.co/mp3-preview/abc123",
            "artists": [
                {
                    "id": "artist1",
                    "name": "Test Artist",
                    "genres": ["rock", "indie"],
                    "followers": {"total": 1000},
                    "images": [{"url": "https://image.url", "height": 640, "width": 480}],
                    "popularity": 75,
                    "uri": "spotify:artist:artist1"
                }
            ],
            "album": {
                "id": "album1",
                "name": "Test Album",
                "images": [{"url": "https://album.image.url", "height": 640, "width": 640}],
                "uri": "spotify:album:album1",
                "artists": [],
                "release_date": "2024-01-15",
                "tracks": {"items": [], "total": 0},
                "album_type": "album",
                "total_tracks": 10
            },
            "images": [
                {"url": "https://track.image.url", "height": 640, "width": 640}
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(SpotifyTrack.self, from: json)

        XCTAssertEqual(track.id, "track123")
        XCTAssertEqual(track.name, "Test Track")
        XCTAssertEqual(track.uri, "spotify:track:track123")
        XCTAssertEqual(track.durationMs, 210000)
        XCTAssertEqual(track.trackNumber, 5)
        XCTAssertEqual(track.discNumber, 1)
        XCTAssertEqual(track.explicit, true)
        XCTAssertEqual(track.popularity, 85)
        XCTAssertEqual(track.previewUrl, "https://p.scdn.co/mp3-preview/abc123")
    }

    func testDecodingMinimalTrack() throws {
        let json = """
        {
            "id": "track456",
            "name": "Minimal Track",
            "uri": "spotify:track:track456"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(SpotifyTrack.self, from: json)

        XCTAssertEqual(track.id, "track456")
        XCTAssertEqual(track.name, "Minimal Track")
        XCTAssertEqual(track.uri, "spotify:track:track456")
        XCTAssertNil(track.durationMs)
        XCTAssertNil(track.artists)
        XCTAssertNil(track.album)
        XCTAssertNil(track.images)
        XCTAssertNil(track.trackNumber)
        XCTAssertNil(track.discNumber)
        XCTAssertNil(track.explicit)
        XCTAssertNil(track.popularity)
        XCTAssertNil(track.previewUrl)
    }

    func testDecodingTrackWithNullOptionals() throws {
        let json = """
        {
            "id": "track789",
            "name": "Null Track",
            "uri": "spotify:track:track789",
            "duration_ms": null,
            "track_number": null,
            "disc_number": null,
            "explicit": null,
            "popularity": null,
            "preview_url": null,
            "artists": null,
            "album": null,
            "images": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(SpotifyTrack.self, from: json)

        XCTAssertEqual(track.id, "track789")
        XCTAssertNil(track.durationMs)
        XCTAssertNil(track.artists)
        XCTAssertNil(track.album)
        XCTAssertNil(track.images)
    }

    // MARK: - Equality Tests

    func testTrackEquality() throws {
        let json1 = """
        {
            "id": "track123",
            "name": "Test Track",
            "uri": "spotify:track:track123",
            "duration_ms": 210000,
            "track_number": 5,
            "disc_number": 1,
            "explicit": true,
            "popularity": 85
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "track123",
            "name": "Test Track",
            "uri": "spotify:track:track123",
            "duration_ms": 210000,
            "track_number": 5,
            "disc_number": 1,
            "explicit": true,
            "popularity": 85
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(SpotifyTrack.self, from: json1)
        let track2 = try decoder.decode(SpotifyTrack.self, from: json2)

        XCTAssertEqual(track1, track2)
    }

    func testTrackInequality() throws {
        let json1 = """
        {
            "id": "track123",
            "name": "Test Track",
            "uri": "spotify:track:track123"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "track456",
            "name": "Different Track",
            "uri": "spotify:track:track456"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(SpotifyTrack.self, from: json1)
        let track2 = try decoder.decode(SpotifyTrack.self, from: json2)

        XCTAssertNotEqual(track1, track2)
    }

    // MARK: - Nested Album/Artist Decoding Tests

    func testDecodingTrackWithNestedAlbum() throws {
        let json = """
        {
            "id": "track999",
            "name": "Album Track",
            "uri": "spotify:track:track999",
            "album": {
                "id": "album99",
                "name": "Nested Album",
                "images": [
                    {"url": "https://example.com/image.jpg", "height": 500, "width": 500}
                ],
                "uri": "spotify:album:album99",
                "artists": [
                    {
                        "id": "artist99",
                        "name": "Album Artist",
                        "genres": null,
                        "followers": null,
                        "images": null,
                        "popularity": null,
                        "uri": "spotify:artist:artist99"
                    }
                ],
                "release_date": "2024-03-01",
                "tracks": {
                    "items": [],
                    "total": 12
                },
                "album_type": "single",
                "total_tracks": 4
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(SpotifyTrack.self, from: json)

        XCTAssertNotNil(track.album)
        XCTAssertEqual(track.album?.id, "album99")
        XCTAssertEqual(track.album?.name, "Nested Album")
        XCTAssertEqual(track.album?.albumType, "single")
        XCTAssertEqual(track.album?.totalTracks, 4)
        XCTAssertEqual(track.album?.tracks?.total, 12)
        XCTAssertEqual(track.album?.artists?.first?.name, "Album Artist")
        XCTAssertEqual(track.album?.images?.first?.url, "https://example.com/image.jpg")
    }

    func testDecodingTrackWithNestedArtists() throws {
        let json = """
        {
            "id": "trackArtist",
            "name": "Multi Artist Track",
            "uri": "spotify:track:trackArtist",
            "artists": [
                {
                    "id": "artistA",
                    "name": "Artist A",
                    "genres": ["pop"],
                    "followers": {"total": 5000},
                    "images": [],
                    "popularity": 90,
                    "uri": "spotify:artist:artistA"
                },
                {
                    "id": "artistB",
                    "name": "Artist B",
                    "genres": ["rock"],
                    "followers": {"total": 3000},
                    "images": [],
                    "popularity": 80,
                    "uri": "spotify:artist:artistB"
                }
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track = try decoder.decode(SpotifyTrack.self, from: json)

        XCTAssertNotNil(track.artists)
        XCTAssertEqual(track.artists?.count, 2)
        XCTAssertEqual(track.artists?[0].name, "Artist A")
        XCTAssertEqual(track.artists?[0].genres, ["pop"])
        XCTAssertEqual(track.artists?[0].followers?.total, 5000)
        XCTAssertEqual(track.artists?[1].name, "Artist B")
        XCTAssertEqual(track.artists?[1].genres, ["rock"])
    }

    // MARK: - Hashable Tests

    func testTrackHashable() throws {
        let json1 = """
        {
            "id": "hashTrack",
            "name": "Hash Track",
            "uri": "spotify:track:hashTrack"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "hashTrack",
            "name": "Hash Track",
            "uri": "spotify:track:hashTrack"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let track1 = try decoder.decode(SpotifyTrack.self, from: json1)
        let track2 = try decoder.decode(SpotifyTrack.self, from: json2)

        var hashSet = Set<SpotifyTrack>()
        hashSet.insert(track1)
        hashSet.insert(track2)

        XCTAssertEqual(hashSet.count, 1)
    }
}
