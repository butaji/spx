import Foundation
import SwiftUI

// MARK: - AppState

@MainActor
final class AppState: ObservableObject {

    // MARK: - Playback State

    @Published var playbackTrack: SpotifyTrack?
    @Published var playbackProgress: Int = 0 // ms
    @Published var playbackDuration: Int = 0 // ms
    @Published var isPlaying: Bool = false
    @Published var playbackVolume: Int = 50
    @Published var isMuted: Bool = false
    @Published var playbackShuffle: Bool = false
    @Published var playbackRepeat: String = "off" // off/context/track
    @Published var likedTrack: Bool = false
    @Published var isPlayActionLoading: Bool = false

    // MARK: - User State

    @Published var userProfile: SpotifyUserProfile?
    @Published var isAuthed: Bool = false
    @Published var isAuthLoading: Bool = false

    // MARK: - App State

    @Published var appError: String?
    @Published var isRestoring: Bool = false
    @Published var currentView: AppView = .home
    @Published var viewHistory: [AppView] = [.home]
    @Published var contextPanelItem: SpotifyArtist?
    @Published var lastPlayedTrack: TrackInfo?
    @Published var isMockMode: Bool = false

    // MARK: - Device State

    @Published var localDevices: [LocalDevice] = []
    @Published var spotifyDevices: [SpotifyDevice] = []

    // MARK: - Private

    private var playbackPollingTask: Task<Void, Never>?
    private var authTask: Task<Void, Never>?
    private let spotifyService: SpotifyServiceProtocol
    private let tokenStorage: TokenStorage

    // MARK: - Init

    init(spotifyService: SpotifyServiceProtocol = SpotifyAPI.shared, tokenStorage: TokenStorage = .shared) {
        self.spotifyService = spotifyService
        self.tokenStorage = tokenStorage
    }

    // MARK: - Navigation

    private let maxHistoryDepth = 50

    func navigate(to view: AppView) {
        viewHistory.append(currentView)
        // Cap history to prevent unbounded growth (allow maxHistoryDepth + 1 for current view)
        if viewHistory.count > maxHistoryDepth + 1 {
            viewHistory.removeFirst(viewHistory.count - maxHistoryDepth - 1)
        }
        currentView = view
    }

    func goBack() {
        guard viewHistory.count > 1 else { return }
        currentView = viewHistory.removeLast()
    }

    // MARK: - Auth

    func handleStartAuth() {
        isAuthLoading = true
        appError = nil

        authTask = Task {
            do {
                try await spotifyService.authorize()
                isAuthed = true
                isAuthLoading = false
                await restoreSession()
            } catch {
                appError = error.localizedDescription
                isAuthLoading = false
            }
        }
    }

    func cancelAuth() {
        authTask?.cancel()
        authTask = nil
        isAuthLoading = false
        appError = nil
    }

    func handleLogout() {
        tokenStorage.delete(key: "spotify_access_token")
        tokenStorage.delete(key: "spotify_refresh_token")
        isAuthed = false
        userProfile = nil
        stopPlaybackPolling()
        currentView = .home
        viewHistory = [.home]
    }

    // MARK: - Playback Controls

    func handlePlayPause() {
        guard !isPlayActionLoading else { return }

        Task {
            isPlayActionLoading = true
            defer { isPlayActionLoading = false }

            do {
                if isPlaying {
                    try await spotifyService.pause()
                    isPlaying = false
                } else {
                    try await spotifyService.resume()
                    isPlaying = true
                }
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func handleNext() {
        Task {
            isPlayActionLoading = true
            defer { isPlayActionLoading = false }

            do {
                try await spotifyService.next()
                await refreshPlaybackState()
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func handlePrev() {
        Task {
            isPlayActionLoading = true
            defer { isPlayActionLoading = false }

            do {
                try await spotifyService.previous()
                await refreshPlaybackState()
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func handleSeek(to ms: Int) {
        Task {
            do {
                try await spotifyService.seek(to: ms)
                playbackProgress = ms
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func handleVolumeChange(_ vol: Int) {
        playbackVolume = max(0, min(100, vol))

        Task {
            do {
                try await spotifyService.setVolume(playbackVolume)
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func handleVolumeUp() {
        handleVolumeChange(playbackVolume + 5)
    }

    func handleVolumeDown() {
        handleVolumeChange(playbackVolume - 5)
    }

    func handleToggleMute() {
        isMuted.toggle()

        Task {
            do {
                try await spotifyService.setVolume(isMuted ? 0 : playbackVolume)
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func handleShuffle() {
        playbackShuffle.toggle()

        Task {
            do {
                try await spotifyService.setShuffle(playbackShuffle)
            } catch {
                appError = error.localizedDescription
                playbackShuffle.toggle() // revert on failure
            }
        }
    }

    func handleRepeat() {
        let modes = ["off", "context", "track"]
        guard let currentIndex = modes.firstIndex(of: playbackRepeat) else { return }
        let nextIndex = (currentIndex + 1) % modes.count
        playbackRepeat = modes[nextIndex]

        Task {
            do {
                try await spotifyService.setRepeat(playbackRepeat)
            } catch {
                appError = error.localizedDescription
                playbackRepeat = modes[currentIndex] // revert on failure
            }
        }
    }

    func handleToggleLike() {
        guard let trackId = playbackTrack?.id else { return }
        likedTrack.toggle()

        Task {
            do {
                if likedTrack {
                    try await spotifyService.saveTrack(id: trackId)
                } else {
                    try await spotifyService.removeTrack(id: trackId)
                }
            } catch {
                appError = error.localizedDescription
                likedTrack.toggle() // revert on failure
            }
        }
    }

    // MARK: - Devices

    func refreshDevices() {
        Task {
            do {
                async let local = spotifyService.getLocalDevices()
                async let spotify = spotifyService.getDevices()

                localDevices = try await local
                spotifyDevices = try await spotify
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func transferPlayback(to deviceId: String) {
        Task {
            do {
                try await spotifyService.transferPlayback(to: deviceId)
                await refreshDevices()
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    // MARK: - Context Playback

    func playContext(uri: String) {
        Task {
            isPlayActionLoading = true
            defer { isPlayActionLoading = false }

            do {
                try await spotifyService.playContext(uri: uri)
                await refreshPlaybackState()
                startPlaybackPolling()
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    func playUris(uris: [String], offset: Int = 0) {
        Task {
            isPlayActionLoading = true
            defer { isPlayActionLoading = false }

            do {
                try await spotifyService.playUris(uris: uris, offset: offset)
                await refreshPlaybackState()
                startPlaybackPolling()
            } catch {
                appError = error.localizedDescription
            }
        }
    }

    // MARK: - Playback State Sync

    func refreshPlaybackState() async {
        do {
            let state = try await spotifyService.getPlaybackState()

            playbackTrack = state.item
            playbackProgress = state.progressMs ?? 0
            playbackDuration = state.item?.durationMs ?? 0
            isPlaying = state.isPlaying ?? false
            playbackVolume = state.device?.volumePercent ?? 50
            playbackShuffle = state.shuffleState ?? false
            playbackRepeat = state.repeatState?.rawValue ?? "off"
            likedTrack = state.item != nil ? (try await spotifyService.checkTrack(id: state.item!.id)) : false

            if let track = state.item {
                lastPlayedTrack = TrackInfo(
                    id: track.id,
                    name: track.name,
                    artist: track.artists?.first?.name ?? "",
                    artistIds: track.artists?.map { $0.id },
                    album: track.album?.name ?? "",
                    durationMs: track.durationMs ?? 0,
                    progressMs: state.progressMs ?? 0,
                    isPlaying: state.isPlaying ?? false,
                    imageUrl: track.images?.first?.url,
                    uri: track.uri
                )
            }
        } catch {
            appError = error.localizedDescription
        }
    }

    // MARK: - Polling

    func startPlaybackPolling() {
        stopPlaybackPolling()

        playbackPollingTask = Task {
            while !Task.isCancelled {
                await refreshPlaybackState()
                try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
            }
        }
    }

    func stopPlaybackPolling() {
        playbackPollingTask?.cancel()
        playbackPollingTask = nil
    }

    // MARK: - Session Restore

    func restoreSession() async {
        isRestoring = true
        defer { isRestoring = false }

        do {
            userProfile = try await spotifyService.getCurrentUser()
            await refreshPlaybackState()
            refreshDevices()
            startPlaybackPolling()
        } catch {
            appError = error.localizedDescription
        }
    }

    // MARK: - Error Handling

    func clearError() {
        appError = nil
    }
}
