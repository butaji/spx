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
        case id, name, artist, artistIds, album, durationMs, progressMs, isPlaying, imageUrl, uri
    }

    init(from track: SpotifyTrack, progressMs: Int = 0) {
        self.id = track.id
        self.name = track.name
        self.artist = track.artists?.map(\.name).compactMap { $0 }.joined(separator: ", ") ?? ""
        self.artistIds = track.artists?.map(\.id)
        self.album = track.album?.name ?? ""
        self.durationMs = track.durationMs ?? 0
        self.progressMs = progressMs
        self.isPlaying = false
        self.imageUrl = track.images?.first?.url
        self.uri = track.uri
    }
}
