import Foundation

struct SpotifyAlbum: Codable, Hashable, Identifiable, Sendable {
    let id: String?
    let name: String
    let images: [SpotifyImage]?
    let uri: String?
    let artists: [SpotifyArtist]?
    let releaseDate: String?
    let tracks: Tracks?
    let albumType: String?
    let totalTracks: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, images, uri, artists, tracks
        case releaseDate = "release_date"
        case albumType = "album_type"
        case totalTracks = "total_tracks"
    }

    struct Tracks: Codable, Hashable, Sendable {
        let items: [SpotifyTrack]
        let total: Int?
    }
}
