import XCTest
@testable import SPX

// MARK: - SpotifyArtistFieldTests

final class SpotifyArtistFieldTests: XCTestCase {

    // MARK: - Followers Tests

    func testDecodingSpotifyArtistWithFollowers() throws {
        let json = Data("""
        {
            "id": "popularArtist",
            "name": "Popular Artist",
            "followers": {
                "total": 10000000
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.followers)
        XCTAssertEqual(artist.followers?.total, 10000000)
    }

    func testDecodingSpotifyArtistWithZeroFollowers() throws {
        let json = Data("""
        {
            "id": "newArtist",
            "name": "New Artist",
            "followers": {
                "total": 0
            }
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.followers)
        XCTAssertEqual(artist.followers?.total, 0)
    }

    func testDecodingSpotifyArtistWithNullFollowers() throws {
        let json = Data("""
        {
            "id": "noFollowers",
            "name": "No Followers Artist",
            "followers": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.followers)
    }

    // MARK: - Images Tests

    func testDecodingSpotifyArtistWithSingleImage() throws {
        let json = Data("""
        {
            "id": "imageArtist",
            "name": "Image Artist",
            "images": [
                {"url": "https://example.com/artist.jpg", "height": 640, "width": 640}
            ]
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertEqual(artist.images?.count, 1)
        XCTAssertEqual(artist.images?[0].url, "https://example.com/artist.jpg")
        XCTAssertEqual(artist.images?[0].height, 640)
        XCTAssertEqual(artist.images?[0].width, 640)
    }

    func testDecodingSpotifyArtistWithMultipleImages() throws {
        let json = Data("""
        {
            "id": "multiImageArtist",
            "name": "Multi Image Artist",
            "images": [
                {"url": "https://example.com/large.jpg", "height": 1000, "width": 1000},
                {"url": "https://example.com/medium.jpg", "height": 500, "width": 500},
                {"url": "https://example.com/small.jpg", "height": 160, "width": 160}
            ]
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertEqual(artist.images?.count, 3)
    }

    func testDecodingSpotifyArtistWithEmptyImages() throws {
        let json = Data("""
        {
            "id": "noImagesArtist",
            "name": "No Images Artist",
            "images": []
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertTrue(artist.images?.isEmpty ?? false)
    }

    func testDecodingSpotifyArtistWithNullImages() throws {
        let json = Data("""
        {
            "id": "nullImagesArtist",
            "name": "Null Images Artist",
            "images": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.images)
    }

    // MARK: - Popularity Tests

    func testDecodingSpotifyArtistPopularityMax() throws {
        let json = Data("""
        {
            "id": "popularMax",
            "name": "Most Popular",
            "popularity": 100
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.popularity, 100)
    }

    func testDecodingSpotifyArtistPopularityMin() throws {
        let json = Data("""
        {
            "id": "popularMin",
            "name": "Least Popular",
            "popularity": 0
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.popularity, 0)
    }

    func testDecodingSpotifyArtistPopularityMid() throws {
        let json = Data("""
        {
            "id": "popularMid",
            "name": "Mid Popularity",
            "popularity": 50
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.popularity, 50)
    }

    // MARK: - URI Tests

    func testDecodingSpotifyArtistWithUri() throws {
        let json = Data("""
        {
            "id": "uriArtist",
            "name": "URI Artist",
            "uri": "spotify:artist:uriArtist"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.uri, "spotify:artist:uriArtist")
    }

    func testDecodingSpotifyArtistWithNullUri() throws {
        let json = Data("""
        {
            "id": "noUri",
            "name": "No URI Artist",
            "uri": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.uri)
    }
}
