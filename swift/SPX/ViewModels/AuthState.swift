import Foundation
import SwiftUI

// MARK: - AuthState

@MainActor
@Observable
final class AuthState {

    // MARK: - Properties

    var userProfile: SpotifyUserProfile?
    var isAuthed: Bool = false
    var isAuthLoading: Bool = false

    // MARK: - Private

    private var authTask: Task<Void, Never>?
    private let spotifyService: SpotifyServiceProtocol
    private let tokenStorage: TokenStorageProtocol

    // MARK: - Init

    init(spotifyService: SpotifyServiceProtocol, tokenStorage: TokenStorageProtocol) {
        self.spotifyService = spotifyService
        self.tokenStorage = tokenStorage
    }

    // MARK: - Auth

    func handleStartAuth() async {
        isAuthLoading = true

        authTask = Task {
            do {
                try await spotifyService.authorize()
                isAuthed = true
                isAuthLoading = false
            } catch {
                isAuthLoading = false
            }
        }
    }

    func cancelAuth() {
        authTask?.cancel()
        authTask = nil
        isAuthLoading = false
    }

    func handleLogout() {
        tokenStorage.delete(key: "spotify_access_token")
        tokenStorage.delete(key: "spotify_refresh_token")
        isAuthed = false
        userProfile = nil
    }

    func restoreSession(
        getCurrentUser: @escaping () async throws -> SpotifyUserProfile
    ) async throws {
        userProfile = try await getCurrentUser()
    }
}
