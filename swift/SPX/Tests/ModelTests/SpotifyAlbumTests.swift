import XCTest
@testable import SPX

final class SpotifyAlbumTests: XCTestCase {

    // MARK: - JSON Decoding Tests

    private var fullAlbumJSON: Data {
        Data("""
        {
            "id": "album123",
            "name": "Test Album",
            "images": [
                {"url": "https://example.com/large.jpg", "height": 640, "width": 640},
                {"url": "https://example.com/small.jpg", "height": 160, "width": 160}
            ],
            "uri": "spotify:album:album123",
            "artists": [
                {
                    "id": "artist1",
                    "name": "Album Artist",
                    "genres": ["rock"],
                    "followers": {"total": 5000},
                    "images": [],
                    "popularity": 80,
                    "uri": "spotify:artist:artist1"
                }
            ],
            "release_date": "2024-05-15",
            "tracks": {
                "items": [
                    {
                        "id": "track1",
                        "name": "Track 1",
                        "uri": "spotify:track:track1"
                    },
                    {
                        "id": "track2",
                        "name": "Track 2",
                        "uri": "spotify:track:track2"
                    }
                ],
                "total": 10
            },
            "album_type": "album",
            "total_tracks": 10
        }
        """.utf8)
    }

    private func assertFullAlbumDecoded(_ album: SpotifyAlbum) {
        XCTAssertEqual(album.id, "album123")
        XCTAssertEqual(album.name, "Test Album")
        XCTAssertEqual(album.uri, "spotify:album:album123")
        XCTAssertEqual(album.releaseDate, "2024-05-15")
        XCTAssertEqual(album.albumType, "album")
        XCTAssertEqual(album.totalTracks, 10)
        XCTAssertEqual(album.images?.count, 2)
        XCTAssertEqual(album.images?[0].url, "https://example.com/large.jpg")
        XCTAssertEqual(album.images?[0].height, 640)
        XCTAssertEqual(album.artists?.first?.name, "Album Artist")
    }

    func testDecodingFullAlbum() throws {
        let album = try JSONDecoder().decode(SpotifyAlbum.self, from: fullAlbumJSON)
        assertFullAlbumDecoded(album)
    }

    func testDecodingMinimalAlbum() throws {
        let json = Data("""
        {
            "id": "album456",
            "name": "Minimal Album"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album = try decoder.decode(SpotifyAlbum.self, from: json)

        XCTAssertEqual(album.id, "album456")
        XCTAssertEqual(album.name, "Minimal Album")
        XCTAssertNil(album.images)
        XCTAssertNil(album.uri)
        XCTAssertNil(album.artists)
        XCTAssertNil(album.releaseDate)
        XCTAssertNil(album.tracks)
        XCTAssertNil(album.albumType)
        XCTAssertNil(album.totalTracks)
    }

    func testDecodingAlbumWithNullOptionals() throws {
        let json = Data("""
        {
            "id": null,
            "name": "Null Album",
            "images": null,
            "uri": null,
            "artists": null,
            "release_date": null,
            "tracks": null,
            "album_type": null,
            "total_tracks": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album = try decoder.decode(SpotifyAlbum.self, from: json)

        XCTAssertNil(album.id)
        XCTAssertEqual(album.name, "Null Album")
        XCTAssertNil(album.images)
        XCTAssertNil(album.uri)
        XCTAssertNil(album.artists)
        XCTAssertNil(album.releaseDate)
        XCTAssertNil(album.tracks)
        XCTAssertNil(album.albumType)
        XCTAssertNil(album.totalTracks)
    }

    // MARK: - Album with Tracks Tests

    private var albumWithTracksJSON: Data {
        Data("""
        {
            "id": "albumWithTracks",
            "name": "Album With Tracks",
            "tracks": {
                "items": [
                    {
                        "id": "trackA",
                        "name": "First Track",
                        "uri": "spotify:track:trackA",
                        "duration_ms": 180000,
                        "track_number": 1
                    },
                    {
                        "id": "trackB",
                        "name": "Second Track",
                        "uri": "spotify:track:trackB",
                        "duration_ms": 240000,
                        "track_number": 2
                    },
                    {
                        "id": "trackC",
                        "name": "Third Track",
                        "uri": "spotify:track:trackC",
                        "duration_ms": 200000,
                        "track_number": 3
                    }
                ],
                "total": 25
            }
        }
        """.utf8)
    }

    private func assertAlbumWithTracksDecoded(_ album: SpotifyAlbum) {
        XCTAssertNotNil(album.tracks)
        XCTAssertEqual(album.tracks?.total, 25)
        XCTAssertEqual(album.tracks?.items.count, 3)
        XCTAssertEqual(album.tracks?.items[0].name, "First Track")
        XCTAssertEqual(album.tracks?.items[0].durationMs, 180000)
        XCTAssertEqual(album.tracks?.items[1].trackNumber, 2)
        XCTAssertEqual(album.tracks?.items[2].id, "trackC")
    }

    func testDecodingAlbumWithTracks() throws {
        let album = try JSONDecoder().decode(SpotifyAlbum.self, from: albumWithTracksJSON)
        assertAlbumWithTracksDecoded(album)
    }

    func testDecodingAlbumWithEmptyTracks() throws {
        let json = Data("""
        {
            "id": "emptyAlbum",
            "name": "Empty Album",
            "tracks": {
                "items": [],
                "total": 0
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album = try decoder.decode(SpotifyAlbum.self, from: json)

        XCTAssertNotNil(album.tracks)
        XCTAssertEqual(album.tracks?.total, 0)
        XCTAssertTrue(album.tracks?.items.isEmpty ?? false)
    }

    // MARK: - Missing Optional Fields Tests

    func testDecodingAlbumWithMissingImages() throws {
        let json = Data("""
        {
            "id": "noImagesAlbum",
            "name": "No Images Album",
            "uri": "spotify:album:noImagesAlbum"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album = try decoder.decode(SpotifyAlbum.self, from: json)

        XCTAssertEqual(album.name, "No Images Album")
        XCTAssertNil(album.images)
    }

    func testDecodingAlbumWithMissingArtists() throws {
        let json = Data("""
        {
            "id": "noArtistsAlbum",
            "name": "No Artists Album",
            "artists": []
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album = try decoder.decode(SpotifyAlbum.self, from: json)

        XCTAssertNotNil(album.artists)
        XCTAssertTrue(album.artists?.isEmpty ?? true)
    }

    func testDecodingAlbumWithPartialTracksData() throws {
        let json = Data("""
        {
            "id": "partialAlbum",
            "name": "Partial Album",
            "tracks": {
                "items": [
                    {
                        "id": "onlyId",
                        "name": "Partial Track",
                        "uri": "spotify:track:onlyId"
                    }
                ]
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album = try decoder.decode(SpotifyAlbum.self, from: json)

        XCTAssertNotNil(album.tracks)
        XCTAssertNil(album.tracks?.total)
        XCTAssertEqual(album.tracks?.items.count, 1)
        XCTAssertEqual(album.tracks?.items[0].name, "Partial Track")
    }

    // MARK: - Equality and Hashable Tests

    func testAlbumEquality() throws {
        let json1 = Data("""
        {
            "id": "albumEq",
            "name": "Equal Album",
            "album_type": "single",
            "total_tracks": 5
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "albumEq",
            "name": "Equal Album",
            "album_type": "single",
            "total_tracks": 5
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album1 = try decoder.decode(SpotifyAlbum.self, from: json1)
        let album2 = try decoder.decode(SpotifyAlbum.self, from: json2)

        XCTAssertEqual(album1, album2)
    }

    func testAlbumInequality() throws {
        let json1 = Data("""
        {
            "id": "albumA",
            "name": "Album A"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "albumB",
            "name": "Album B"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let album1 = try decoder.decode(SpotifyAlbum.self, from: json1)
        let album2 = try decoder.decode(SpotifyAlbum.self, from: json2)

        XCTAssertNotEqual(album1, album2)
    }

    func testAlbumTracksHashable() throws {
        let json1 = Data("""
        {
            "items": [{"id": "t1", "name": "Track 1", "uri": "spotify:track:t1"}],
            "total": 1
        }
        """.utf8)

        let json2 = Data("""
        {
            "items": [{"id": "t1", "name": "Track 1", "uri": "spotify:track:t1"}],
            "total": 1
        }
        """.utf8)

        let decoder = JSONDecoder()
        let tracks1 = try decoder.decode(SpotifyAlbum.Tracks.self, from: json1)
        let tracks2 = try decoder.decode(SpotifyAlbum.Tracks.self, from: json2)

        XCTAssertEqual(tracks1, tracks2)
    }
}
