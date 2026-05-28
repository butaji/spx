import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var hotkeyManager = HotkeyManager()

    var body: some View {
        if appState.isRestoring {
            LoadingView()
                .background(Color.spxBase)
        } else if !appState.isAuthed {
            AuthView {
                appState.handleStartAuth()
            }
        } else {
            mainLayout
        }
    }

    private var mainLayout: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                SidebarView()
                    .frame(width: 108)

                mainContentView
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            PlayerBarView(
                trackName: appState.playbackTrack?.name ?? "",
                artistName: appState.lastPlayedTrack?.artist ?? "",
                artworkUrl: appState.playbackTrack?.album?.images?.first?.url,
                isPlaying: appState.isPlaying,
                isLiked: appState.likedTrack,
                shuffleActive: appState.playbackShuffle,
                repeatMode: appState.playbackRepeat,
                progress: Double(appState.playbackProgress) / Double(max(appState.playbackDuration, 1)),
                currentTimeMs: appState.playbackProgress,
                durationMs: appState.playbackDuration,
                volume: Double(appState.playbackVolume) / 100.0,
                onPlayPause: { Task { await appState.handlePlayPause() } },
                onNext: { Task { await appState.handleNext() } },
                onPrev: { Task { await appState.handlePrev() } },
                onSeek: { progress in
                    let millis = Int(progress * Double(appState.playbackDuration))
                    Task { await appState.handleSeek(to: millis) }
                },
                onVolumeChange: { volume in
                    Task { await appState.handleVolumeChange(Int(volume * 100)) }
                },
                onToggleShuffle: { Task { await appState.handleShuffle() } },
                onToggleRepeat: { Task { await appState.handleRepeat() } },
                onToggleLike: { Task { await appState.handleToggleLike() } }
            )
            .frame(height: 80)
        }
        .background(Color.spxBase)
        .onAppear {
            hotkeyManager.start(appState: appState)
        }
        .onDisappear {
            hotkeyManager.stop()
        }
        .onChange(of: scenePhase) {
            switch scenePhase {
            case .background:
                appState.stopPlaybackPolling()
            case .active:
                if appState.isAuthed {
                    appState.startPlaybackPolling()
                }
            case .inactive:
                break
            @unknown default:
                break
            }
        }
    }

    @ViewBuilder
    private var mainContentView: some View {
        switch appState.currentView {
        case .home:
            HomeView(
                track: appState.lastPlayedTrack,
                isPlaying: appState.isPlaying,
                liked: appState.likedTrack,
                artistDetail: appState.playback.artistDetail,
                tags: appState.playback.tags,
                playlists: appState.playback.playlists,
                userName: appState.playback.playlists.first?.name ?? "User",
                userImage: appState.playback.playlists.first?.image,
                artistListenCount: appState.playback.artistListenCount,
                trackListenCount: appState.playback.trackListenCount,
                onToggleLike: { Task { await appState.handleToggleLike() } }
            )
        case .search:
            SearchView(
                onPlayTrack: { _ in },
                onNavigate: { _ in }
            )
        case .library:
            LibraryView(
                onPlayContext: { _ in },
                onPlayUris: { _, _ in },
                onNavigate: { _ in }
            )
        case .queue:
            QueueView(
                currentTrack: appState.playbackTrack,
                queue: [],
                onPlayUris: { uris, offset in
                    appState.playUris(uris: uris, offset: offset ?? 0)
                }
            )
        default:
            EmptyView()
        }
    }
}
