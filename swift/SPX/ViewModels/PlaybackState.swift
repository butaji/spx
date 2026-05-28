import Foundation
import SwiftUI

// MARK: - PlaybackState

@MainActor
@Observable
final class PlaybackState {

    // MARK: - Published Properties

    var playbackTrack: SpotifyTrack?
    var lastPlayedTrack: TrackInfo?
    var playbackProgress: Int = 0 // ms
    var playbackDuration: Int = 0 // ms
    var isPlaying: Bool = false
    var playbackVolume: Int = 50
    var isMuted: Bool = false
    var playbackShuffle: Bool = false
    var playbackRepeat: String = "off" // off/context/track
    var likedTrack: Bool = false
    var isPlayActionLoading: Bool = false
    var errorMessage: String?

    // MARK: - Preview/Mock Properties

    var artistDetail: SpotifyArtist?
    var tags: [String] = []
    var userName: String = ""
    var userImage: String?
    var playlists: [PlaylistItem] = []
    var artistListenCount: Int = 0
    var trackListenCount: Int = 0

    // MARK: - Private

    private var playbackPollingTask: Task<Void, Never>?
    private let spotifyService: SpotifyServiceProtocol

    // MARK: - Init

    init(spotifyService: SpotifyServiceProtocol) {
        self.spotifyService = spotifyService
    }

    // MARK: - Playback Controls

    func handlePlayPause() async {
        guard !isPlayActionLoading else { return }

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
            errorMessage = error.localizedDescription
        }
    }

    func handleNext() async {
        isPlayActionLoading = true
        defer { isPlayActionLoading = false }

        do {
            try await spotifyService.next()
            await refreshPlaybackState()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handlePrev() async {
        isPlayActionLoading = true
        defer { isPlayActionLoading = false }

        do {
            try await spotifyService.previous()
            await refreshPlaybackState()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleSeek(to millis: Int) async {
        do {
            try await spotifyService.seek(to: millis)
            playbackProgress = millis
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleVolumeChange(_ vol: Int) async {
        playbackVolume = max(0, min(100, vol))
        do {
            try await spotifyService.setVolume(playbackVolume)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleVolumeUp() async {
        await handleVolumeChange(playbackVolume + 5)
    }

    func handleVolumeDown() async {
        await handleVolumeChange(playbackVolume - 5)
    }

    func handleToggleMute() {
        isMuted.toggle()

        Task {
            do {
                try await spotifyService.setVolume(isMuted ? 0 : playbackVolume)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func handleShuffle() async {
        playbackShuffle.toggle()
        do {
            try await spotifyService.setShuffle(playbackShuffle)
        } catch {
            playbackShuffle.toggle() // revert
            errorMessage = error.localizedDescription
        }
    }

    func handleRepeat() async {
        let modes = ["off", "context", "track"]
        guard let currentIndex = modes.firstIndex(of: playbackRepeat) else { return }
        let nextIndex = (currentIndex + 1) % modes.count
        playbackRepeat = modes[nextIndex]
        do {
            try await spotifyService.setRepeat(playbackRepeat)
        } catch {
            playbackRepeat = modes[currentIndex] // revert
            errorMessage = error.localizedDescription
        }
    }

    func handleToggleLike() async {
        guard let trackId = playbackTrack?.id else { return }
        likedTrack.toggle()

        do {
            if likedTrack {
                try await spotifyService.saveTrack(id: trackId)
            } else {
                try await spotifyService.removeTrack(id: trackId)
            }
        } catch {
            likedTrack.toggle() // revert on failure
            errorMessage = error.localizedDescription
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
                errorMessage = error.localizedDescription
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
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Playback State Sync

    func refreshPlaybackState() async {
        do {
            let state = try await spotifyService.getPlaybackState()

            playbackTrack = state.item
            if let track = state.item {
                lastPlayedTrack = TrackInfo(from: track, progressMs: state.progressMs ?? 0)
            }
            playbackProgress = state.progressMs ?? 0
            playbackDuration = state.item?.durationMs ?? 0
            isPlaying = state.isPlaying ?? false
            playbackVolume = state.device?.volumePercent ?? 50
            playbackShuffle = state.shuffleState ?? false
            playbackRepeat = state.repeatState?.rawValue ?? "off"
            likedTrack = state.item != nil
                ? (try await spotifyService.checkTrack(id: state.item?.id ?? ""))
                : false
        } catch {
            errorMessage = error.localizedDescription
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
}
