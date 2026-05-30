import XCTest
@testable import SPX

// MARK: - SpotifyArtistFollowersTests

final class SpotifyArtistFollowersTests: XCTestCase {

    // MARK: - Followers Hashable and Equality Tests

    func testSpotifyArtistFollowersEquality() throws {
        let json1 = Data("""
        {
            "total": 1000
        }
        """.utf8)

        let json2 = Data("""
        {
            "total": 1000
        }
        """.utf8)

        let decoder = JSONDecoder()
        let followers1 = try decoder.decode(SpotifyArtist.Followers.self, from: json1)
        let followers2 = try decoder.decode(SpotifyArtist.Followers.self, from: json2)

        XCTAssertEqual(followers1, followers2)
    }

    func testSpotifyArtistFollowersHashable() throws {
        let json1 = Data("""
        {
            "total": 5000
        }
        """.utf8)

        let json2 = Data("""
        {
            "total": 5000
        }
        """.utf8)

        let decoder = JSONDecoder()
        let followers1 = try decoder.decode(SpotifyArtist.Followers.self, from: json1)
        let followers2 = try decoder.decode(SpotifyArtist.Followers.self, from: json2)

        var hashSet = Set<SpotifyArtist.Followers>()
        hashSet.insert(followers1)
        hashSet.insert(followers2)

        XCTAssertEqual(hashSet.count, 1)
    }

    // MARK: - Complex Artist Tests

    func testDecodingSpotifyArtistWithAllData() throws {
        let json = Data("""
        {
            "id": "completeArtist",
            "name": "Complete Artist",
            "genres": ["pop", "rock", "dance", "electronic"],
            "followers": {
                "total": 50000000
            },
            "images": [
                {"url": "https://example.com/640.jpg", "height": 640, "width": 640},
                {"url": "https://example.com/320.jpg", "height": 320, "width": 320},
                {"url": "https://example.com/160.jpg", "height": 160, "width": 160}
            ],
            "popularity": 98,
            "uri": "spotify:artist:completeArtist"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "completeArtist")
        XCTAssertEqual(artist.name, "Complete Artist")
        XCTAssertEqual(artist.genres?.count, 4)
        XCTAssertEqual(artist.followers?.total, 50000000)
        XCTAssertEqual(artist.images?.count, 3)
        XCTAssertEqual(artist.popularity, 98)
        XCTAssertEqual(artist.uri, "spotify:artist:completeArtist")
    }

    func testDecodingSpotifyArtistWithImageNullDimensions() throws {
        let json = Data("""
        {
            "id": "nullDimArtist",
            "name": "Null Dimensions Artist",
            "images": [
                {"url": "https://example.com/image.jpg", "height": null, "width": null}
            ]
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertEqual(artist.images?[0].url, "https://example.com/image.jpg")
        XCTAssertNil(artist.images?[0].height)
        XCTAssertNil(artist.images?[0].width)
    }
}
