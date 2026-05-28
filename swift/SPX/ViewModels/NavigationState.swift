import Foundation
import SwiftUI

// MARK: - NavigationState

@MainActor
@Observable
final class NavigationState {

    // MARK: - Properties

    var currentView: AppView = .home
    var viewHistory: [AppView] = [.home]
    var contextPanelItem: SpotifyArtist?

    // MARK: - Private

    private let maxHistoryDepth = 50

    // MARK: - Navigation

    func navigate(to view: AppView) {
        viewHistory.append(currentView)
        // Cap history to prevent unbounded growth
        if viewHistory.count > maxHistoryDepth + 1 {
            viewHistory.removeFirst(viewHistory.count - maxHistoryDepth - 1)
        }
        currentView = view
    }

    func goBack() {
        guard viewHistory.count > 1 else { return }
        currentView = viewHistory.removeLast()
    }

    func resetToHome() {
        currentView = .home
        viewHistory = [.home]
    }
}
