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
    private let tokenStorage: TokenStorage

    // MARK: - Init

    init(spotifyService: SpotifyServiceProtocol, tokenStorage: TokenStorage) {
        self.spotifyService = spotifyService
        self.tokenStorage = tokenStorage
    }

    // MARK: - Auth

    func handleStartAuth(
        onSuccess: @escaping () async -> Void,
        onError: @escaping (Error) -> Void
    ) {
        isAuthLoading = true

        authTask = Task {
            do {
                try await spotifyService.authorize()
                isAuthed = true
                isAuthLoading = false
                await onSuccess()
            } catch {
                isAuthLoading = false
                onError(error)
            }
        }
    }

    func cancelAuth() {
        authTask?.cancel()
        authTask = nil
        isAuthLoading = false
    }

    func handleLogout(stopPlaybackPolling: @escaping () -> Void) {
        tokenStorage.delete(key: "spotify_access_token")
        tokenStorage.delete(key: "spotify_refresh_token")
        isAuthed = false
        userProfile = nil
        stopPlaybackPolling()
    }

    func restoreSession(
        getCurrentUser: @escaping () async throws -> SpotifyUserProfile
    ) async throws {
        userProfile = try await getCurrentUser()
    }
}
