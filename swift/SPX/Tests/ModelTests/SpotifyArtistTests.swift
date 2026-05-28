import XCTest
@testable import SPX

final class SpotifyArtistTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullSpotifyArtist() throws {
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
        {
            "id": "minimalArtist",
            "name": "Minimal"
        }
        """.data(using: .utf8)!

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
        let json = """
        {
            "id": "requiredOnly",
            "name": "Required Only"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "requiredOnly")
        XCTAssertEqual(artist.name, "Required Only")
    }

    // MARK: - Null Handling Tests

    func testDecodingSpotifyArtistWithNullOptionals() throws {
        let json = """
        {
            "id": "nullArtist",
            "name": "Null Artist",
            "genres": null,
            "followers": null,
            "images": null,
            "popularity": null,
            "uri": null
        }
        """.data(using: .utf8)!

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
        let json = """
        {
            "id": "singleGenre",
            "name": "Single Genre Artist",
            "genres": ["pop"]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.genres)
        XCTAssertEqual(artist.genres?.count, 1)
        XCTAssertEqual(artist.genres?[0], "pop")
    }

    func testDecodingSpotifyArtistWithManyGenres() throws {
        let json = """
        {
            "id": "manyGenres",
            "name": "Many Genres Artist",
            "genres": ["rock", "pop", "indie", "alternative", "metal", "punk", "grunge", "classic rock", "hard rock", "progressive rock"]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.genres)
        XCTAssertEqual(artist.genres?.count, 10)
    }

    func testDecodingSpotifyArtistWithEmptyGenres() throws {
        let json = """
        {
            "id": "noGenres",
            "name": "No Genres Artist",
            "genres": []
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.genres)
        XCTAssertTrue(artist.genres?.isEmpty ?? false)
    }

    func testDecodingSpotifyArtistWithNullGenres() throws {
        let json = """
        {
            "id": "nullGenres",
            "name": "Null Genres Artist",
            "genres": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.genres)
    }

    // MARK: - Followers Tests

    func testDecodingSpotifyArtistWithFollowers() throws {
        let json = """
        {
            "id": "popularArtist",
            "name": "Popular Artist",
            "followers": {
                "total": 10000000
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.followers)
        XCTAssertEqual(artist.followers?.total, 10000000)
    }

    func testDecodingSpotifyArtistWithZeroFollowers() throws {
        let json = """
        {
            "id": "newArtist",
            "name": "New Artist",
            "followers": {
                "total": 0
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.followers)
        XCTAssertEqual(artist.followers?.total, 0)
    }

    func testDecodingSpotifyArtistWithNullFollowers() throws {
        let json = """
        {
            "id": "noFollowers",
            "name": "No Followers Artist",
            "followers": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.followers)
    }

    // MARK: - Images Tests

    func testDecodingSpotifyArtistWithSingleImage() throws {
        let json = """
        {
            "id": "imageArtist",
            "name": "Image Artist",
            "images": [
                {"url": "https://example.com/artist.jpg", "height": 640, "width": 640}
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertEqual(artist.images?.count, 1)
        XCTAssertEqual(artist.images?[0].url, "https://example.com/artist.jpg")
        XCTAssertEqual(artist.images?[0].height, 640)
        XCTAssertEqual(artist.images?[0].width, 640)
    }

    func testDecodingSpotifyArtistWithMultipleImages() throws {
        let json = """
        {
            "id": "multiImageArtist",
            "name": "Multi Image Artist",
            "images": [
                {"url": "https://example.com/large.jpg", "height": 1000, "width": 1000},
                {"url": "https://example.com/medium.jpg", "height": 500, "width": 500},
                {"url": "https://example.com/small.jpg", "height": 160, "width": 160}
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertEqual(artist.images?.count, 3)
    }

    func testDecodingSpotifyArtistWithEmptyImages() throws {
        let json = """
        {
            "id": "noImagesArtist",
            "name": "No Images Artist",
            "images": []
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertTrue(artist.images?.isEmpty ?? false)
    }

    func testDecodingSpotifyArtistWithNullImages() throws {
        let json = """
        {
            "id": "nullImagesArtist",
            "name": "Null Images Artist",
            "images": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.images)
    }

    // MARK: - Popularity Tests

    func testDecodingSpotifyArtistPopularityMax() throws {
        let json = """
        {
            "id": "popularMax",
            "name": "Most Popular",
            "popularity": 100
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.popularity, 100)
    }

    func testDecodingSpotifyArtistPopularityMin() throws {
        let json = """
        {
            "id": "popularMin",
            "name": "Least Popular",
            "popularity": 0
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.popularity, 0)
    }

    func testDecodingSpotifyArtistPopularityMid() throws {
        let json = """
        {
            "id": "popularMid",
            "name": "Mid Popularity",
            "popularity": 50
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.popularity, 50)
    }

    // MARK: - URI Tests

    func testDecodingSpotifyArtistWithUri() throws {
        let json = """
        {
            "id": "uriArtist",
            "name": "URI Artist",
            "uri": "spotify:artist:uriArtist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.uri, "spotify:artist:uriArtist")
    }

    func testDecodingSpotifyArtistWithNullUri() throws {
        let json = """
        {
            "id": "noUri",
            "name": "No URI Artist",
            "uri": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNil(artist.uri)
    }

    // MARK: - Equality Tests

    func testSpotifyArtistEquality() throws {
        let json1 = """
        {
            "id": "equalArtist",
            "name": "Equal Artist",
            "genres": ["pop"],
            "popularity": 80
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "equalArtist",
            "name": "Equal Artist",
            "genres": ["pop"],
            "popularity": 80
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        XCTAssertEqual(artist1, artist2)
    }

    func testSpotifyArtistInequality() throws {
        let json1 = """
        {
            "id": "artistA",
            "name": "Artist A"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "artistB",
            "name": "Artist B"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        XCTAssertNotEqual(artist1, artist2)
    }

    func testSpotifyArtistInequalityById() throws {
        let json1 = """
        {
            "id": "sameName1",
            "name": "Same Name"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "sameName2",
            "name": "Same Name"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        XCTAssertNotEqual(artist1, artist2)
    }

    // MARK: - Hashable Tests

    func testSpotifyArtistHashable() throws {
        let json1 = """
        {
            "id": "hashArtist",
            "name": "Hash Artist",
            "genres": ["rock"],
            "popularity": 75
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "hashArtist",
            "name": "Hash Artist",
            "genres": ["rock"],
            "popularity": 75
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        var hashSet = Set<SpotifyArtist>()
        hashSet.insert(artist1)
        hashSet.insert(artist2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testSpotifyArtistHashableInDictionary() throws {
        let json = """
        {
            "id": "dictArtist",
            "name": "Dictionary Artist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        var dict = [SpotifyArtist: String]()
        dict[artist] = "testValue"

        XCTAssertEqual(dict[artist], "testValue")
    }

    // MARK: - Followers Hashable and Equality Tests

    func testSpotifyArtistFollowersEquality() throws {
        let json1 = """
        {
            "total": 1000
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "total": 1000
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let followers1 = try decoder.decode(SpotifyArtist.Followers.self, from: json1)
        let followers2 = try decoder.decode(SpotifyArtist.Followers.self, from: json2)

        XCTAssertEqual(followers1, followers2)
    }

    func testSpotifyArtistFollowersHashable() throws {
        let json1 = """
        {
            "total": 5000
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "total": 5000
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let followers1 = try decoder.decode(SpotifyArtist.Followers.self, from: json1)
        let followers2 = try decoder.decode(SpotifyArtist.Followers.self, from: json2)

        var hashSet = Set<SpotifyArtist.Followers>()
        hashSet.insert(followers1)
        hashSet.insert(followers2)

        XCTAssertEqual(hashSet.count, 1)
    }

    // MARK: - Identifiable Tests

    func testSpotifyArtistIdentifiable() throws {
        let json = """
        {
            "id": "identifiableArtist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "identifiableArtist")
    }

    // MARK: - Complex Artist Tests

    func testDecodingSpotifyArtistWithAllData() throws {
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
        {
            "id": "nullDimArtist",
            "name": "Null Dimensions Artist",
            "images": [
                {"url": "https://example.com/image.jpg", "height": null, "width": null}
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertNotNil(artist.images)
        XCTAssertEqual(artist.images?[0].url, "https://example.com/image.jpg")
        XCTAssertNil(artist.images?[0].height)
        XCTAssertNil(artist.images?[0].width)
    }
}
