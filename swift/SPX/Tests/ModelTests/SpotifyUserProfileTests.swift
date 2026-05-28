import XCTest
@testable import SPX

final class SpotifyUserProfileTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullUserProfile() throws {
        let json = """
        {
            "id": "user123",
            "display_name": "Test User",
            "email": "test@example.com",
            "country": "US",
            "product": "premium",
            "href": "https://api.spotify.com/v1/users/user123",
            "uri": "spotify:user:user123",
            "images": [
                {"url": "https://example.com/avatar.jpg", "height": 500, "width": 500},
                {"url": "https://example.com/avatar_small.jpg", "height": 100, "width": 100}
            ],
            "followers": {
                "total": 1500,
                "href": "https://api.spotify.com/v1/users/user123/followers"
            },
            "external_urls": {
                "spotify": "https://open.spotify.com/user/user123"
            },
            "explicit_content": {
                "filter_enabled": true,
                "filter_locked": false
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertEqual(profile.id, "user123")
        XCTAssertEqual(profile.displayName, "Test User")
        XCTAssertEqual(profile.email, "test@example.com")
        XCTAssertEqual(profile.country, "US")
        XCTAssertEqual(profile.product, "premium")
        XCTAssertEqual(profile.href, "https://api.spotify.com/v1/users/user123")
        XCTAssertEqual(profile.uri, "spotify:user:user123")

        XCTAssertNotNil(profile.images)
        XCTAssertEqual(profile.images?.count, 2)
        XCTAssertEqual(profile.images?[0].url, "https://example.com/avatar.jpg")
        XCTAssertEqual(profile.images?[0].height, 500)
        XCTAssertEqual(profile.images?[0].width, 500)
        XCTAssertEqual(profile.images?[1].url, "https://example.com/avatar_small.jpg")

        XCTAssertNotNil(profile.followers)
        XCTAssertEqual(profile.followers?.total, 1500)
        XCTAssertEqual(profile.followers?.href, "https://api.spotify.com/v1/users/user123/followers")

        XCTAssertNotNil(profile.externalUrls)
        XCTAssertEqual(profile.externalUrls?.spotify, "https://open.spotify.com/user/user123")

        XCTAssertNotNil(profile.explicitContent)
        XCTAssertEqual(profile.explicitContent?.filterEnabled, true)
        XCTAssertEqual(profile.explicitContent?.filterLocked, false)
    }

    func testDecodingUserProfileWithMinimalData() throws {
        let json = """
        {
            "id": "minimalUser"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertEqual(profile.id, "minimalUser")
        XCTAssertNil(profile.displayName)
        XCTAssertNil(profile.email)
        XCTAssertNil(profile.country)
        XCTAssertNil(profile.product)
        XCTAssertNil(profile.href)
        XCTAssertNil(profile.uri)
        XCTAssertNil(profile.images)
        XCTAssertNil(profile.followers)
        XCTAssertNil(profile.externalUrls)
        XCTAssertNil(profile.explicitContent)
    }

    func testDecodingUserProfileWithNullOptionals() throws {
        let json = """
        {
            "id": "nullUser",
            "display_name": null,
            "email": null,
            "country": null,
            "product": null,
            "href": null,
            "uri": null,
            "images": null,
            "followers": null,
            "external_urls": null,
            "explicit_content": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertEqual(profile.id, "nullUser")
        XCTAssertNil(profile.displayName)
        XCTAssertNil(profile.email)
        XCTAssertNil(profile.country)
        XCTAssertNil(profile.product)
        XCTAssertNil(profile.images)
        XCTAssertNil(profile.followers)
        XCTAssertNil(profile.externalUrls)
        XCTAssertNil(profile.explicitContent)
    }

    // MARK: - Followers Tests

    func testDecodingUserProfileWithFollowers() throws {
        let json = """
        {
            "id": "followerUser",
            "followers": {
                "total": 9999,
                "href": "https://api.spotify.com/v1/users/followerUser/followers"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.followers)
        XCTAssertEqual(profile.followers?.total, 9999)
        XCTAssertEqual(profile.followers?.href, "https://api.spotify.com/v1/users/followerUser/followers")
    }

    func testDecodingUserProfileWithNullFollowers() throws {
        let json = """
        {
            "id": "noFollowers",
            "followers": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNil(profile.followers)
    }

    func testDecodingUserProfileWithFollowersZeroTotal() throws {
        let json = """
        {
            "id": "newUser",
            "followers": {
                "total": 0
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.followers)
        XCTAssertEqual(profile.followers?.total, 0)
        XCTAssertNil(profile.followers?.href)
    }

    // MARK: - ExplicitContent Tests

    func testDecodingUserProfileWithExplicitContent() throws {
        let json = """
        {
            "id": "explicitUser",
            "explicit_content": {
                "filter_enabled": true,
                "filter_locked": true
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.explicitContent)
        XCTAssertEqual(profile.explicitContent?.filterEnabled, true)
        XCTAssertEqual(profile.explicitContent?.filterLocked, true)
    }

    func testDecodingUserProfileWithExplicitContentAllNull() throws {
        let json = """
        {
            "id": "cleanUser",
            "explicit_content": {
                "filter_enabled": null,
                "filter_locked": null
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.explicitContent)
        XCTAssertNil(profile.explicitContent?.filterEnabled)
        XCTAssertNil(profile.explicitContent?.filterLocked)
    }

    // MARK: - Images Tests

    func testDecodingUserProfileWithSingleImage() throws {
        let json = """
        {
            "id": "imageUser",
            "images": [
                {"url": "https://example.com/user.jpg", "height": 300, "width": 300}
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.images)
        XCTAssertEqual(profile.images?.count, 1)
        XCTAssertEqual(profile.images?[0].url, "https://example.com/user.jpg")
        XCTAssertEqual(profile.images?[0].height, 300)
        XCTAssertEqual(profile.images?[0].width, 300)
    }

    func testDecodingUserProfileWithEmptyImagesArray() throws {
        let json = """
        {
            "id": "noImageUser",
            "images": []
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.images)
        XCTAssertTrue(profile.images?.isEmpty ?? false)
    }

    func testDecodingUserProfileWithImageNullDimensions() throws {
        let json = """
        {
            "id": "nullDimImage",
            "images": [
                {"url": "https://example.com/image.jpg", "height": null, "width": null}
            ]
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.images)
        XCTAssertEqual(profile.images?[0].url, "https://example.com/image.jpg")
        XCTAssertNil(profile.images?[0].height)
        XCTAssertNil(profile.images?[0].width)
    }

    // MARK: - ExternalUrls Tests

    func testDecodingUserProfileWithExternalUrls() throws {
        let json = """
        {
            "id": "socialUser",
            "external_urls": {
                "spotify": "https://open.spotify.com/user/socialUser"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertNotNil(profile.externalUrls)
        XCTAssertEqual(profile.externalUrls?.spotify, "https://open.spotify.com/user/socialUser")
    }

    // MARK: - Equality and Hashable Tests

    func testUserProfileEquality() throws {
        let json1 = """
        {
            "id": "equalUser",
            "display_name": "Equal Name",
            "email": "equal@example.com",
            "country": "US",
            "product": "free"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "equalUser",
            "display_name": "Equal Name",
            "email": "equal@example.com",
            "country": "US",
            "product": "free"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile1 = try decoder.decode(SpotifyUserProfile.self, from: json1)
        let profile2 = try decoder.decode(SpotifyUserProfile.self, from: json2)

        XCTAssertEqual(profile1, profile2)
    }

    func testUserProfileInequality() throws {
        let json1 = """
        {
            "id": "userA"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "userB"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile1 = try decoder.decode(SpotifyUserProfile.self, from: json1)
        let profile2 = try decoder.decode(SpotifyUserProfile.self, from: json2)

        XCTAssertNotEqual(profile1, profile2)
    }

    func testUserProfileHashable() throws {
        let json1 = """
        {
            "id": "hashUser",
            "display_name": "Hash User"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "hashUser",
            "display_name": "Hash User"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile1 = try decoder.decode(SpotifyUserProfile.self, from: json1)
        let profile2 = try decoder.decode(SpotifyUserProfile.self, from: json2)

        var hashSet = Set<SpotifyUserProfile>()
        hashSet.insert(profile1)
        hashSet.insert(profile2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testFollowersEquality() throws {
        let json1 = """
        {
            "total": 100,
            "href": "https://example.com/followers"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "total": 100,
            "href": "https://example.com/followers"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let followers1 = try decoder.decode(Followers.self, from: json1)
        let followers2 = try decoder.decode(Followers.self, from: json2)

        XCTAssertEqual(followers1, followers2)
        XCTAssertEqual(followers1.hashValue, followers2.hashValue)
    }

    func testExplicitContentEquality() throws {
        let json1 = """
        {
            "filter_enabled": true,
            "filter_locked": false
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "filter_enabled": true,
            "filter_locked": false
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let content1 = try decoder.decode(ExplicitContent.self, from: json1)
        let content2 = try decoder.decode(ExplicitContent.self, from: json2)

        XCTAssertEqual(content1, content2)
        XCTAssertEqual(content1.hashValue, content2.hashValue)
    }

    // MARK: - CodingKeys Tests

    func testSpotifyUserProfileCodingKeys() throws {
        let json = """
        {
            "display_name": "Coding Keys Test",
            "external_urls": {
                "spotify": "https://spotify.com"
            },
            "explicit_content": {
                "filter_enabled": false,
                "filter_locked": true
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let profile = try decoder.decode(SpotifyUserProfile.self, from: json)

        XCTAssertEqual(profile.displayName, "Coding Keys Test")
        XCTAssertNotNil(profile.externalUrls)
        XCTAssertNotNil(profile.explicitContent)
    }
}
