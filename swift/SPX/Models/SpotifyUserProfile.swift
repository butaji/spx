import Foundation

struct SpotifyUserProfile: Codable, Hashable, Sendable {
    let id: String?
    let displayName: String?
    let images: [SpotifyImage]?
    let email: String?
    let country: String?
    let product: String?
    let followers: Followers?
    let externalUrls: ExternalUrls?
    let href: String?
    let uri: String?
    let explicitContent: ExplicitContent?

    enum CodingKeys: String, CodingKey {
        case id, images, email, country, product, followers, href, uri
        case displayName = "display_name"
        case externalUrls = "external_urls"
        case explicitContent = "explicit_content"
    }

    struct Followers: Codable, Hashable, Sendable {
        let total: Int?
        let href: String?
    }

    struct ExternalUrls: Codable, Hashable, Sendable {
        let spotify: String?
    }

    struct ExplicitContent: Codable, Hashable, Sendable {
        let filterEnabled: Bool?
        let filterLocked: Bool?

        enum CodingKeys: String, CodingKey {
            case filterEnabled = "filter_enabled"
            case filterLocked = "filter_locked"
        }
    }
}
