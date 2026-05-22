import Foundation

struct SpotifyPlaybackState: Codable, Hashable, Sendable {
    let isPlaying: Bool?
    let shuffleState: Bool?
    let repeatState: RepeatState?
    let progressMs: Int?
    let item: SpotifyTrack?
    let device: SpotifyDevice?
    let timestamp: Int?
    let context: Context?

    enum CodingKeys: String, CodingKey {
        case isPlaying = "is_playing"
        case shuffleState = "shuffle_state"
        case repeatState = "repeat_state"
        case progressMs = "progress_ms"
        case item, device, timestamp, context
    }

    enum RepeatState: String, Codable, Hashable, Sendable {
        case off
        case context
        case track
    }

    struct Context: Codable, Hashable, Sendable {
        let type: String?
        let href: String?
        let externalUrls: ExternalUrls?
        let uri: String?

        enum CodingKeys: String, CodingKey {
            case type, href, uri
            case externalUrls = "external_urls"
        }

        struct ExternalUrls: Codable, Hashable, Sendable {
            let spotify: String?
        }
    }
}
