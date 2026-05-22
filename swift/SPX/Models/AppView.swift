import Foundation

enum AppView: Hashable, Sendable {
    case home
    case search
    case library(tab: String?)
    case queue
    case playlist(id: String, name: String)
    case album(id: String, name: String)
    case artist(id: String, name: String)
}
