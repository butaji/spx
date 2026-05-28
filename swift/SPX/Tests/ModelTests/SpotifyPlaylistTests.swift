import XCTest
@testable import SPX

final class SpotifyPlaylistTests: XCTestCase {

    // MARK: - JSON Decoding Tests

    func testDecodingFullPlaylist() throws {
        let json = """
        {
            "id": "playlist123",
            "name": "Test Playlist",
            "description": "A test playlist description",
            "images": [
                {"url": "https://example.com/playlist.jpg", "height": 500, "width": 500}
            ],
            "uri": "spotify:playlist:playlist123",
            "collaborative": false,
            "snapshot_id": "snapshot123",
            "primary_color": "#FFFFFF",
            "public": true,
            "followed": false,
            "owner": {
                "id": "user123",
                "display_name": "Test User",
                "href": "https://api.spotify.com/v1/users/user123",
                "uri": "spotify:user:user123",
                "external_urls": {
                    "spotify": "https://open.spotify.com/user/user123"
                }
            },
            "tracks": {
                "total": 25,
                "href": "https://api.spotify.com/v1/playlists/playlist123/tracks"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertEqual(playlist.id, "playlist123")
        XCTAssertEqual(playlist.name, "Test Playlist")
        XCTAssertEqual(playlist.description, "A test playlist description")
        XCTAssertEqual(playlist.uri, "spotify:playlist:playlist123")
        XCTAssertEqual(playlist.collaborative, false)
        XCTAssertEqual(playlist.snapshotId, "snapshot123")
        XCTAssertEqual(playlist.primaryColor, "#FFFFFF")
        XCTAssertEqual(playlist.public, true)
        XCTAssertEqual(playlist.followed, false)
        XCTAssertEqual(playlist.images?.count, 1)
        XCTAssertEqual(playlist.images?[0].url, "https://example.com/playlist.jpg")
    }

    func testDecodingMinimalPlaylist() throws {
        let json = """
        {
            "id": "playlist456",
            "name": "Minimal Playlist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertEqual(playlist.id, "playlist456")
        XCTAssertEqual(playlist.name, "Minimal Playlist")
        XCTAssertNil(playlist.description)
        XCTAssertNil(playlist.images)
        XCTAssertNil(playlist.owner)
        XCTAssertNil(playlist.uri)
        XCTAssertNil(playlist.tracks)
        XCTAssertNil(playlist.collaborative)
        XCTAssertNil(playlist.snapshotId)
        XCTAssertNil(playlist.primaryColor)
        XCTAssertNil(playlist.public)
        XCTAssertNil(playlist.followed)
    }

    func testDecodingPlaylistWithNullOptionals() throws {
        let json = """
        {
            "id": "playlistNull",
            "name": "Null Playlist",
            "description": null,
            "images": null,
            "uri": null,
            "collaborative": null,
            "snapshot_id": null,
            "primary_color": null,
            "public": null,
            "followed": null,
            "owner": null,
            "tracks": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertEqual(playlist.name, "Null Playlist")
        XCTAssertNil(playlist.description)
        XCTAssertNil(playlist.images)
        XCTAssertNil(playlist.owner)
        XCTAssertNil(playlist.tracks)
    }

    // MARK: - Playlist Items Tests

    func testDecodingPlaylistWithTracks() throws {
        let json = """
        {
            "id": "playlistWithTracks",
            "name": "Playlist With Tracks",
            "tracks": {
                "total": 100,
                "href": "https://api.spotify.com/v1/playlists/playlistWithTracks/tracks"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNotNil(playlist.tracks)
        XCTAssertEqual(playlist.tracks?.total, 100)
        XCTAssertEqual(playlist.tracks?.href, "https://api.spotify.com/v1/playlists/playlistWithTracks/tracks")
    }

    func testDecodingPlaylistWithEmptyTracks() throws {
        let json = """
        {
            "id": "emptyPlaylist",
            "name": "Empty Playlist",
            "tracks": {
                "total": 0,
                "href": null
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNotNil(playlist.tracks)
        XCTAssertEqual(playlist.tracks?.total, 0)
        XCTAssertNil(playlist.tracks?.href)
    }

    // MARK: - Owner Info Tests

    func testDecodingPlaylistWithFullOwner() throws {
        let json = """
        {
            "id": "playlistOwner",
            "name": "Owner Playlist",
            "owner": {
                "id": "owner123",
                "display_name": "Owner Name",
                "href": "https://api.spotify.com/v1/users/owner123",
                "uri": "spotify:user:owner123",
                "external_urls": {
                    "spotify": "https://open.spotify.com/user/owner123"
                }
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNotNil(playlist.owner)
        XCTAssertEqual(playlist.owner?.id, "owner123")
        XCTAssertEqual(playlist.owner?.displayName, "Owner Name")
        XCTAssertEqual(playlist.owner?.href, "https://api.spotify.com/v1/users/owner123")
        XCTAssertEqual(playlist.owner?.uri, "spotify:user:owner123")
        XCTAssertNotNil(playlist.owner?.externalUrls)
        XCTAssertEqual(playlist.owner?.externalUrls?.spotify, "https://open.spotify.com/user/owner123")
    }

    func testDecodingPlaylistWithMinimalOwner() throws {
        let json = """
        {
            "id": "minimalOwnerPlaylist",
            "name": "Minimal Owner Playlist",
            "owner": {
                "id": "owner456"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNotNil(playlist.owner)
        XCTAssertEqual(playlist.owner?.id, "owner456")
        XCTAssertNil(playlist.owner?.displayName)
        XCTAssertNil(playlist.owner?.href)
        XCTAssertNil(playlist.owner?.uri)
        XCTAssertNil(playlist.owner?.externalUrls)
    }

    func testDecodingPlaylistWithOwnerNullExternalUrls() throws {
        let json = """
        {
            "id": "nullUrlsPlaylist",
            "name": "Null URLs Playlist",
            "owner": {
                "id": "owner789",
                "display_name": "Owner 789",
                "external_urls": null
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNotNil(playlist.owner)
        XCTAssertEqual(playlist.owner?.id, "owner789")
        XCTAssertNil(playlist.owner?.externalUrls)
    }

    // MARK: - Missing Optional Fields Tests

    func testDecodingPlaylistWithMissingDescription() throws {
        let json = """
        {
            "id": "noDescPlaylist",
            "name": "No Description Playlist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertEqual(playlist.name, "No Description Playlist")
        XCTAssertNil(playlist.description)
    }

    func testDecodingPlaylistWithMissingImages() throws {
        let json = """
        {
            "id": "noImagesPlaylist",
            "name": "No Images Playlist",
            "images": []
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNotNil(playlist.images)
        XCTAssertTrue(playlist.images?.isEmpty ?? true)
    }

    func testDecodingPlaylistWithMissingOwner() throws {
        let json = """
        {
            "id": "noOwnerPlaylist",
            "name": "No Owner Playlist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist = try decoder.decode(SpotifyPlaylist.self, from: json)

        XCTAssertNil(playlist.owner)
    }

    // MARK: - Equality Tests

    func testPlaylistEquality() throws {
        let json1 = """
        {
            "id": "playlistEq",
            "name": "Equal Playlist",
            "collaborative": false,
            "public": true
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "playlistEq",
            "name": "Equal Playlist",
            "collaborative": false,
            "public": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist1 = try decoder.decode(SpotifyPlaylist.self, from: json1)
        let playlist2 = try decoder.decode(SpotifyPlaylist.self, from: json2)

        XCTAssertEqual(playlist1, playlist2)
    }

    func testPlaylistInequality() throws {
        let json1 = """
        {
            "id": "playlistA",
            "name": "Playlist A"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "playlistB",
            "name": "Playlist B"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist1 = try decoder.decode(SpotifyPlaylist.self, from: json1)
        let playlist2 = try decoder.decode(SpotifyPlaylist.self, from: json2)

        XCTAssertNotEqual(playlist1, playlist2)
    }

    func testOwnerEquality() throws {
        let json1 = """
        {
            "id": "ownerEq",
            "display_name": "Equal Owner",
            "href": "https://example.com"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "ownerEq",
            "display_name": "Equal Owner",
            "href": "https://example.com"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let owner1 = try decoder.decode(Owner.self, from: json1)
        let owner2 = try decoder.decode(Owner.self, from: json2)

        XCTAssertEqual(owner1, owner2)
    }

    // MARK: - Hashable Tests

    func testPlaylistHashable() throws {
        let json1 = """
        {
            "id": "hashPlaylist",
            "name": "Hash Playlist"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "hashPlaylist",
            "name": "Hash Playlist"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let playlist1 = try decoder.decode(SpotifyPlaylist.self, from: json1)
        let playlist2 = try decoder.decode(SpotifyPlaylist.self, from: json2)

        var hashSet = Set<SpotifyPlaylist>()
        hashSet.insert(playlist1)
        hashSet.insert(playlist2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testOwnerHashable() throws {
        let json1 = """
        {
            "id": "hashOwner",
            "display_name": "Hash Owner"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "hashOwner",
            "display_name": "Hash Owner"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let owner1 = try decoder.decode(Owner.self, from: json1)
        let owner2 = try decoder.decode(Owner.self, from: json2)

        var hashSet = Set<Owner>()
        hashSet.insert(owner1)
        hashSet.insert(owner2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testExternalUrlsHashable() throws {
        let json1 = """
        {
            "spotify": "https://open.spotify.com/user/test"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "spotify": "https://open.spotify.com/user/test"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let urls1 = try decoder.decode(ExternalUrls.self, from: json1)
        let urls2 = try decoder.decode(ExternalUrls.self, from: json2)

        XCTAssertEqual(urls1, urls2)
        XCTAssertEqual(urls1.hashValue, urls2.hashValue)
    }
}
