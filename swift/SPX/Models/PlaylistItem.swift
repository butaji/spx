import Foundation

struct PlaylistItem: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let image: String?
}
