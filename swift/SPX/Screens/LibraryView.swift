import SwiftUI

// MARK: - Library View
struct LibraryView: View {
    @State private var selectedTab: LibraryTab = .playlists
    @State private var playlists: [SpotifyPlaylist] = []
    @State private var tracks: [SpotifyTrack] = []
    @State private var albums: [SpotifyAlbum] = []
    @State private var topTracks: [SpotifyTrack] = []
    @State private var isLoading: Bool = true
    @State private var isRefreshing: Bool = false

    let onPlayContext: (String) -> Void
    let onPlayUris: ([String], Int?) -> Void
    let onNavigate: (AppView) -> Void

    enum LibraryTab: String, CaseIterable {
        case playlists = "Playlists"
        case tracks = "Songs"
        case albums = "Albums"
        case top = "Top"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Your Library")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(SPXColors.fg)

                Spacer()

                if isRefreshing {
                    Text("Updating...")
                        .font(.system(size: 12))
                        .foregroundColor(SPXColors.fgMuted)
                }
            }
            .padding(.bottom, SPXSpacing.x4)

            // Tab Bar
            HStack(spacing: SPXSpacing.x2) {
                ForEach(LibraryTab.allCases, id: \.self) { tab in
                    Button(action: { selectedTab = tab }) {
                        Text(tab.rawValue)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(selectedTab == tab ? SPXColors.fg : SPXColors.fgFaint)
                            .padding(.horizontal, SPXSpacing.x3)
                            .padding(.vertical, SPXSpacing.x2)
                            .background(selectedTab == tab ? SPXColors.surface : Color.clear)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(selectedTab == tab ? SPXColors.edge : Color.clear, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, SPXSpacing.x4)

            // Content
            if isLoading && currentItems.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(SPXColors.accent)
                    Spacer()
                }
                Spacer()
            } else {
                ScrollView {
                    switch selectedTab {
                    case .playlists:
                        playlistGridView
                    case .tracks:
                        trackListView
                    case .albums:
                        albumGridView
                    case .top:
                        trackListView
                    }
                }
            }
        }
        .padding(.horizontal, SPXSpacing.x6)
        .padding(.top, SPXSpacing.x4)
        .background(SPXColors.bg)
    }

    // MARK: - Current Items
    private var currentItems: [Any] {
        switch selectedTab {
        case .playlists: return playlists
        case .tracks: return tracks
        case .albums: return albums
        case .top: return topTracks
        }
    }

    // MARK: - Playlist Grid View
    private var playlistGridView: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: SPXSpacing.x4)], spacing: SPXSpacing.x4) {
            ForEach(playlists, id: \.id) { playlist in
                LibraryItemView(item: .playlist(playlist))
                    .onTapGesture {
                        onNavigate(AppView.playlist(id: playlist.id, name: playlist.name))
                    }
            }
        }
        .padding(.bottom, 100)
    }

    // MARK: - Album Grid View
    private var albumGridView: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: SPXSpacing.x4)], spacing: SPXSpacing.x4) {
            ForEach(albums, id: \.id) { album in
                LibraryItemView(item: .album(album))
                    .onTapGesture {
                        if let id = album.id {
                            onNavigate(AppView.album(id: id, name: album.name))
                        }
                    }
            }
        }
        .padding(.bottom, 100)
    }

    // MARK: - Track List View
    private var trackListView: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(currentTracks.enumerated()), id: \.element.id) { index, track in
                LibraryTrackRow(
                    track: track,
                    index: index,
                    onPlay: {
                        onPlayContext(track.uri)
                    }
                )
            }
        }
        .padding(.bottom, 100)
    }

    private var currentTracks: [SpotifyTrack] {
        switch selectedTab {
        case .tracks: return tracks
        case .top: return topTracks
        default: return []
        }
    }
}

// MARK: - Library Track Row
struct LibraryTrackRow: View {
    let track: SpotifyTrack
    let index: Int
    let onPlay: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: SPXSpacing.x3) {
            Text("\(index + 1)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(SPXColors.fgFaint)
                .frame(width: 32, alignment: .center)

            // Artwork
            if let imageUrl = track.album?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 4).fill(SPXColors.surface)
                }
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                RoundedRectangle(cornerRadius: 4)
                    .fill(SPXColors.surface)
                    .frame(width: 40, height: 40)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(track.name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(SPXColors.fg)
                    .lineLimit(1)

                Text(track.artists?.map { $0.name }.joined(separator: ", ") ?? "")
                    .font(.system(size: 12))
                    .foregroundColor(SPXColors.fgFaint)
                    .lineLimit(1)
            }

            Spacer()

            // Album name
            Text(track.album?.name ?? "")
                .font(.system(size: 12))
                .foregroundColor(SPXColors.fgFaint)
                .lineLimit(1)
                .frame(maxWidth: 120)

            Text(formatTime(track.durationMs ?? 0))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(SPXColors.fgFaint)
        }
        .padding(.horizontal, SPXSpacing.x2)
        .padding(.vertical, SPXSpacing.x2)
        .background(isHovered ? SPXColors.bgHover : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: SPXRadius.sm))
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onPlay()
        }
    }
}
