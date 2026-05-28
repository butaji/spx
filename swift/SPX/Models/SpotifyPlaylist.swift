import Foundation

struct Owner: Codable, Hashable, Sendable {
    let id: String?
    let displayName: String?
    let href: String?
    let uri: String?
    let externalUrls: ExternalUrls?

    enum CodingKeys: String, CodingKey {
        case id, href, uri
        case displayName = "display_name"
        case externalUrls = "external_urls"
    }
}

struct Tracks: Codable, Hashable, Sendable {
    let total: Int?
    let href: String?
}

struct SpotifyPlaylist: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let images: [SpotifyImage]?
    let owner: Owner?
    let uri: String?
    let tracks: Tracks?
    let collaborative: Bool?
    let snapshotId: String?
    let primaryColor: String?
    let `public`: Bool?
    let followed: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, description, images, owner, uri, tracks, collaborative
        case snapshotId = "snapshot_id"
        case primaryColor = "primary_color"
        case `public`
        case followed
    }
}

typealias SpotifyPlaylistOwner = Owner
