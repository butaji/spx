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
                    .foregroundColor(Color.spxTextPrimary)
                    .padding(.top, 24)

                Spacer()

                if isRefreshing {
                    Text("Updating...")
                        .font(.system(size: 12))
                        .foregroundColor(Color.spxTextTertiary)
                }
            }
            .padding(.bottom, 16)

            // Tab Bar
            HStack(spacing: 8) {
                ForEach(LibraryTab.allCases, id: \.self) { tab in
                    Button(action: { selectedTab = tab }) {
                        Text(tab.rawValue)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(selectedTab == tab ? Color.spxTextPrimary : Color.spxTextTertiary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selectedTab == tab ? Color.spxElevated : Color.clear)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(selectedTab == tab ? Color.spxBorder : Color.clear, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, 16)

            // Content
            if isLoading && currentItems.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.spxAccent)
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
                .scrollIndicators(.hidden)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
        .background(Color.spxBase)
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
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 16)], spacing: 16) {
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
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 16)], spacing: 16) {
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
        HStack(spacing: 12) {
            Text("\(index + 1)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.spxTextTertiary)
                .frame(width: 32, alignment: .center)

            // Artwork
            if let imageUrl = track.album?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 4).fill(Color.spxElevated)
                }
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.spxElevated)
                    .frame(width: 40, height: 40)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(track.name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.spxTextPrimary)
                    .lineLimit(1)

                Text(track.artists?.compactMap { $0.name }.joined(separator: ", ") ?? "")
                    .font(.system(size: 12))
                    .foregroundColor(Color.spxTextTertiary)
                    .lineLimit(1)
            }

            Spacer()

            // Album name
            Text(track.album?.name ?? "")
                .font(.system(size: 12))
                .foregroundColor(Color.spxTextTertiary)
                .lineLimit(1)
                .frame(maxWidth: 120)

            Text(String.formatDuration(millis: track.durationMs ?? 0))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.spxTextTertiary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(isHovered ? Color.spxOverlay : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onPlay()
        }
    }
}
