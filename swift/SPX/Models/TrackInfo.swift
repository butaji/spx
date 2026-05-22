import Foundation

struct TrackInfo: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let artist: String
    let artistIds: [String]?
    let album: String
    let durationMs: Int
    let progressMs: Int
    let isPlaying: Bool
    let imageUrl: String?
    let uri: String

    enum CodingKeys: String, CodingKey {
        case id, name, artist, album, uri
        case artistIds = "artistIds"
        case durationMs = "durationMs"
        case progressMs = "progressMs"
        case isPlaying = "isPlaying"
        case imageUrl = "imageUrl"
    }
}
