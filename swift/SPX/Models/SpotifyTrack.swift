import Foundation

struct SpotifyTrack: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let uri: String
    let durationMs: Int?
    let artists: [SpotifyArtist]?
    let album: SpotifyAlbum?
    let images: [SpotifyImage]?
    let trackNumber: Int?
    let discNumber: Int?
    let explicit: Bool?
    let popularity: Int?
    let previewUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, name, uri, artists, album, images, popularity
        case durationMs = "duration_ms"
        case trackNumber = "track_number"
        case discNumber = "disc_number"
        case explicit = "explicit"
        case previewUrl = "preview_url"
    }
}
