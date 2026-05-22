import Foundation

struct SpotifyDevice: Codable, Hashable, Sendable, Identifiable {
    let id: String?
    let name: String?
    let volumePercent: Int?
    let type: String?
    let isActive: Bool?
    let isPrivateSession: Bool?
    let isRestricted: Bool?
    let supportsVolume: Bool?
    let isLocal: Bool?
    let localNote: String?
    let canTransfer: Bool?
    let needsWakeUp: Bool?
    let deviceIp: String?

    enum CodingKeys: String, CodingKey {
        case id, name, type
        case volumePercent = "volume_percent"
        case isActive = "is_active"
        case isPrivateSession = "is_private_session"
        case isRestricted = "is_restricted"
        case supportsVolume = "supports_volume"
        case isLocal = "isLocal"
        case localNote = "localNote"
        case canTransfer = "canTransfer"
        case needsWakeUp = "needsWakeUp"
        case deviceIp = "deviceIp"
    }
}
