import XCTest
@testable import SPX

// MARK: - SpotifyArtistEqualityTests

final class SpotifyArtistEqualityTests: XCTestCase {

    // MARK: - Equality Tests

    func testSpotifyArtistEquality() throws {
        let json1 = Data("""
        {
            "id": "equalArtist",
            "name": "Equal Artist",
            "genres": ["pop"],
            "popularity": 80
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "equalArtist",
            "name": "Equal Artist",
            "genres": ["pop"],
            "popularity": 80
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        XCTAssertEqual(artist1, artist2)
    }

    func testSpotifyArtistInequality() throws {
        let json1 = Data("""
        {
            "id": "artistA",
            "name": "Artist A"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "artistB",
            "name": "Artist B"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        XCTAssertNotEqual(artist1, artist2)
    }

    func testSpotifyArtistInequalityById() throws {
        let json1 = Data("""
        {
            "id": "sameName1",
            "name": "Same Name"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "sameName2",
            "name": "Same Name"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        XCTAssertNotEqual(artist1, artist2)
    }

    // MARK: - Hashable Tests

    func testSpotifyArtistHashable() throws {
        let json1 = Data("""
        {
            "id": "hashArtist",
            "name": "Hash Artist",
            "genres": ["rock"],
            "popularity": 75
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "hashArtist",
            "name": "Hash Artist",
            "genres": ["rock"],
            "popularity": 75
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist1 = try decoder.decode(SpotifyArtist.self, from: json1)
        let artist2 = try decoder.decode(SpotifyArtist.self, from: json2)

        var hashSet = Set<SpotifyArtist>()
        hashSet.insert(artist1)
        hashSet.insert(artist2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testSpotifyArtistHashableInDictionary() throws {
        let json = Data("""
        {
            "id": "dictArtist",
            "name": "Dictionary Artist"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        var dict = [SpotifyArtist: String]()
        dict[artist] = "testValue"

        XCTAssertEqual(dict[artist], "testValue")
    }

    // MARK: - Identifiable Tests

    func testSpotifyArtistIdentifiable() throws {
        let json = Data("""
        {
            "id": "identifiableArtist"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let artist = try decoder.decode(SpotifyArtist.self, from: json)

        XCTAssertEqual(artist.id, "identifiableArtist")
    }
}
