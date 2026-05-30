import XCTest
@testable import SPX

// MARK: - SpotifyArtistDecodingTests

final class SpotifyArtistDecodingTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullSpotifyArtist() throws {
        let json = Data("""
        {
            "id": "artist123",
            "name": "Test Artist",
            "genres": ["pop", "rock", "electronic"],
            "followers": {
                "total": 1500000
            },
            "images": [
                {"url": "https://example.com/artist_big.jpg", "height": 1000, "width": 1000},
                {"url": "https://example.com/artist_small.jpg", "height": 500, "width": 500}
            ],
            "popularity": 85,
            "uri": "spotify:artist:artist123"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "artist123")
        XCTAssertEqual(artist.name, "Test Artist")
        XCTAssertEqual(artist.genres, ["pop", "rock", "electronic"])
        XCTAssertEqual(artist.followers?.total, 1500000)
        XCTAssertEqual(artist.images?.count, 2)
        XCTAssertEqual(artist.images?[0].url, "https://example.com/artist_big.jpg")
        XCTAssertEqual(artist.images?[0].height, 1000)
        XCTAssertEqual(artist.images?[0].width, 1000)
        XCTAssertEqual(artist.images?[1].url, "https://example.com/artist_small.jpg")
        XCTAssertEqual(artist.popularity, 85)
        XCTAssertEqual(artist.uri, "spotify:artist:artist123")
    }

    func testDecodingSpotifyArtistWithAllFields() throws {
        let json = Data("""
        {
            "id": "fullArtist",
            "name": "Full Artist",
            "genres": ["indie", "alternative", "folk"],
            "followers": {
                "total": 999999
            },
            "images": [
                {"url": "https://example.com/full.jpg", "height": 800, "width": 800}
            ],
            "popularity": 92,
            "uri": "spotify:artist:fullArtist"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "fullArtist")
        XCTAssertEqual(artist.name, "Full Artist")
        XCTAssertEqual(artist.genres?.count, 3)
        XCTAssertEqual(artist.followers?.total, 999999)
        XCTAssertEqual(artist.images?.count, 1)
        XCTAssertEqual(artist.popularity, 92)
        XCTAssertEqual(artist.uri, "spotify:artist:fullArtist")
    }

    // MARK: - Minimal JSON Decoding Tests

    func testDecodingMinimalSpotifyArtist() throws {
        let json = Data("""
        {
            "id": "minimalArtist",
            "name": "Minimal"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "minimalArtist")
        XCTAssertEqual(artist.name, "Minimal")
        XCTAssertNil(artist.genres)
        XCTAssertNil(artist.followers)
        XCTAssertNil(artist.images)
        XCTAssertNil(artist.popularity)
        XCTAssertNil(artist.uri)
    }

    func testDecodingSpotifyArtistWithOnlyRequiredFields() throws {
        let json = Data("""
        {
            "id": "requiredOnly",
            "name": "Required Only"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "requiredOnly")
        XCTAssertEqual(artist.name, "Required Only")
    }

    // MARK: - Null Handling Tests

    func testDecodingSpotifyArtistWithNullOptionals() throws {
        let json = Data("""
        {
            "id": "nullArtist",
            "name": "Null Artist",
            "genres": null,
            "followers": null,
            "images": null,
            "popularity": null,
            "uri": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "nullArtist")
        XCTAssertEqual(artist.name, "Null Artist")
        XCTAssertNil(artist.genres)
        XCTAssertNil(artist.followers)
        XCTAssertNil(artist.images)
        XCTAssertNil(artist.popularity)
        XCTAssertNil(artist.uri)
    }

    // MARK: - Genres Tests

    func testDecodingSpotifyArtistWithSingleGenre() throws {
        let json = Data("""
        {
            "id": "singleGenre",
            "name": "Single Genre Artist",
            "genres": ["pop"]
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.genres)
        XCTAssertEqual(artist.genres?.count, 1)
        XCTAssertEqual(artist.genres?[0], "pop")
    }

    func testDecodingSpotifyArtistWithManyGenres() throws {
        let genres = ["rock", "pop", "indie", "alternative", "metal", "punk",
                      "grunge", "classic rock", "hard rock", "progressive rock"]
        let json = Data("""
        {
            "id": "manyGenres",
            "name": "Many Genres Artist",
            "genres": [\(genres.map { "\"\($0)\"" }.joined(separator: ", "))]
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.genres)
        XCTAssertEqual(artist.genres?.count, 10)
    }

    func testDecodingSpotifyArtistWithEmptyGenres() throws {
        let json = Data("""
        {
            "id": "noGenres",
            "name": "No Genres Artist",
            "genres": []
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.genres)
        XCTAssertTrue(artist.genres?.isEmpty ?? false)
    }

    func testDecodingSpotifyArtistWithNullGenres() throws {
        let json = Data("""
        {
            "id": "nullGenres",
            "name": "Null Genres Artist",
            "genres": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.genres)
    }
}
