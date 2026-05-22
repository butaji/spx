import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var hotkeyManager = HotkeyManager()
    @State private var selectedSidebarItem: SidebarItem = .nowPlaying

    private var showContextPanel: Bool {
        appState.contextPanelItem != nil
    }

    var body: some View {
        if appState.isRestoring {
            LoadingView()
                .background(Color(hex: "#0a0a0a"))
        } else if !appState.isAuthed {
            AuthView {
                appState.handleStartAuth()
            }
            .environmentObject(appState)
        } else {
            mainLayout
        }
    }

    private var mainLayout: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                SidebarView(selectedItem: $selectedSidebarItem)
                    .frame(width: 110)

                Divider()
                    .background(Color(hex: "#0a0a0a").opacity(0.08))

                mainContentView
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(EdgeInsets(top: 16, leading: 24, bottom: 28, trailing: 28))

                if showContextPanel {
                    Divider()
                        .background(Color(hex: "#0a0a0a").opacity(0.08))

                    ContextPanelView()
                        .frame(width: 280)
                }
            }

            Divider()
                .background(Color(hex: "#0a0a0a").opacity(0.08))

            PlayerBarView(
                trackName: appState.playbackTrack?.name ?? "",
                artistName: appState.playbackTrack?.artists?.first?.name ?? "",
                artworkUrl: appState.playbackTrack?.album?.images?.first?.url,
                isPlaying: appState.isPlaying,
                isLiked: appState.likedTrack,
                shuffleActive: appState.playbackShuffle,
                repeatMode: appState.playbackRepeat,
                progress: Double(appState.playbackProgress) / Double(max(appState.playbackDuration, 1)),
                currentTimeMs: appState.playbackProgress,
                durationMs: appState.playbackDuration,
                volume: Double(appState.playbackVolume) / 100.0,
                onPlayPause: { appState.handlePlayPause() },
                onNext: { appState.handleNext() },
                onPrev: { appState.handlePrev() },
                onSeek: { progress in
                    let ms = Int(progress * Double(appState.playbackDuration))
                    appState.handleSeek(to: ms)
                },
                onVolumeChange: { appState.handleVolumeChange(Int($0 * 100)) },
                onToggleShuffle: { appState.handleShuffle() },
                onToggleRepeat: { appState.handleRepeat() },
                onToggleLike: { appState.handleToggleLike() }
            )
            .frame(height: 68)
        }
        .background(Color(hex: "#0a0a0a"))
        .onAppear {
            hotkeyManager.start(appState: appState)
        }
        .onDisappear {
            hotkeyManager.stop()
        }
        .onChange(of: selectedSidebarItem) { _, newItem in
            switch newItem {
            case .nowPlaying:
                appState.navigate(to: .home)
            case .search:
                appState.navigate(to: .search)
            case .library:
                appState.navigate(to: .library(tab: nil))
            case .queue:
                appState.navigate(to: .queue)
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
                artistDetail: appState.contextPanelItem,
                artistTopTracks: [],
                tags: [],
                playlists: [],
                userName: appState.userProfile?.displayName ?? "",
                userImage: appState.userProfile?.images?.first?.url,
                onToggleLike: { appState.handleToggleLike() },
                onPlayTrack: { _ in },
                onNavigate: { _ in }
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
