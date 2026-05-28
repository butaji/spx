import Foundation

struct SpotifyArtist: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String?
    let genres: [String]?
    let followers: Followers?
    let images: [SpotifyImage]?
    let popularity: Int?
    let uri: String?

    struct Followers: Codable, Hashable, Sendable {
        let total: Int
    }
}
