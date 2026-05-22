import SwiftUI

// MARK: - Search View
struct SearchView: View {
    @State private var query: String = ""
    @State private var results: SpotifySearchResults?
    @State private var selectedFilter: SearchFilter = .all
    @State private var isLoading: Bool = false

    let onPlayTrack: (SpotifyTrack) -> Void
    let onNavigate: (AppView) -> Void

    enum SearchFilter: String, CaseIterable {
        case all = "All"
        case tracks = "Tracks"
        case albums = "Albums"
        case artists = "Artists"
        case playlists = "Playlists"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Screen Title
            Text("Search")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(SPXColors.fg)
                .padding(.bottom, SPXSpacing.x4)

            // Search Bar
            HStack(spacing: SPXSpacing.x2) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(SPXColors.fgFaint)
                    .font(.system(size: 14))

                TextField("What do you want to listen to?", text: $query)
                    .font(.system(size: 13))
                    .foregroundColor(SPXColors.fg)
                    .tint(SPXColors.accent)
                    .onSubmit {
                        performSearch()
                    }

                Button(action: performSearch) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(SPXColors.fgSecondary)
                        .font(.system(size: 16))
                }
                .buttonStyle(.plain)
            }
            .padding(SPXSpacing.x3)
            .background(SPXColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: SPXRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SPXRadius.md)
                    .stroke(SPXColors.edge, lineWidth: 1)
            )
            .padding(.bottom, SPXSpacing.x4)

            // Filter Tabs
            if results != nil {
                HStack(spacing: SPXSpacing.x2) {
                    ForEach(SearchFilter.allCases, id: \.self) { filter in
                        Button(action: { selectedFilter = filter }) {
                            Text(filter.rawValue)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(selectedFilter == filter ? SPXColors.fg : SPXColors.fgFaint)
                                .padding(.horizontal, SPXSpacing.x3)
                                .padding(.vertical, SPXSpacing.x2)
                                .background(selectedFilter == filter ? SPXColors.surface : Color.clear)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(selectedFilter == filter ? SPXColors.edge : Color.clear, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, SPXSpacing.x4)
            }

            // Content
            if isLoading {
                Spacer()
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(SPXColors.accent)
                    Spacer()
                }
                Spacer()
            } else if let results = results {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: SPXSpacing.x8) {
                        switch selectedFilter {
                        case .all:
                            allResultsView(results)
                        case .tracks:
                            tracksResultsView(results)
                        case .albums:
                            albumsResultsView(results)
                        case .artists:
                            artistsResultsView(results)
                        case .playlists:
                            playlistsResultsView(results)
                        }
                    }
                    .padding(.bottom, 100)
                }
            } else {
                emptyStateView
            }
        }
        .padding(.horizontal, SPXSpacing.x6)
        .padding(.top, SPXSpacing.x4)
        .background(SPXColors.bg)
    }

    // MARK: - All Results View
    @ViewBuilder
    private func allResultsView(_ results: SpotifySearchResults) -> some View {
        if let tracks = results.tracks?.items, !tracks.isEmpty {
            VStack(alignment: .leading, spacing: SPXSpacing.x3) {
                Text("Tracks")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(SPXColors.fg)

                ForEach(Array(tracks.prefix(5).enumerated()), id: \.element.id) { index, track in
                    SearchTrackRow(track: track, index: index, onPlay: { onPlayTrack(track) })
                }
            }
        }

        if let albums = results.albums?.items, !albums.isEmpty {
            VStack(alignment: .leading, spacing: SPXSpacing.x3) {
                Text("Albums")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(SPXColors.fg)

                LibraryGridView(items: albums.map { LibraryItem.album($0) }, onNavigate: onNavigate)
            }
        }

        if let artists = results.artists?.items, !artists.isEmpty {
            VStack(alignment: .leading, spacing: SPXSpacing.x3) {
                Text("Artists")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(SPXColors.fg)

                LibraryGridView(items: artists.map { LibraryItem.artist($0) }, onNavigate: onNavigate)
            }
        }

        if let playlists = results.playlists?.items, !playlists.isEmpty {
            VStack(alignment: .leading, spacing: SPXSpacing.x3) {
                Text("Playlists")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(SPXColors.fg)

                LibraryGridView(items: playlists.map { LibraryItem.playlist($0) }, onNavigate: onNavigate)
            }
        }
    }

    // MARK: - Tracks Results View
    @ViewBuilder
    private func tracksResultsView(_ results: SpotifySearchResults) -> some View {
        if let tracks = results.tracks?.items, !tracks.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                    SearchTrackRow(track: track, index: index, onPlay: { onPlayTrack(track) })
                }
            }
        } else {
            emptyResultsView
        }
    }

    // MARK: - Albums Results View
    @ViewBuilder
    private func albumsResultsView(_ results: SpotifySearchResults) -> some View {
        if let albums = results.albums?.items, !albums.isEmpty {
            LibraryGridView(items: albums.map { LibraryItem.album($0) }, onNavigate: onNavigate)
        } else {
            emptyResultsView
        }
    }

    // MARK: - Artists Results View
    @ViewBuilder
    private func artistsResultsView(_ results: SpotifySearchResults) -> some View {
        if let artists = results.artists?.items, !artists.isEmpty {
            LibraryGridView(items: artists.map { LibraryItem.artist($0) }, onNavigate: onNavigate)
        } else {
            emptyResultsView
        }
    }

    // MARK: - Playlists Results View
    @ViewBuilder
    private func playlistsResultsView(_ results: SpotifySearchResults) -> some View {
        if let playlists = results.playlists?.items, !playlists.isEmpty {
            LibraryGridView(items: playlists.map { LibraryItem.playlist($0) }, onNavigate: onNavigate)
        } else {
            emptyResultsView
        }
    }

    // MARK: - Empty State
    private var emptyStateView: some View {
        VStack(spacing: SPXSpacing.x4) {
            Spacer()
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(SPXColors.fgMuted.opacity(0.5))

            Text("Search for songs, albums, artists, or playlists")
                .font(.system(size: 14))
                .foregroundColor(SPXColors.fgSecondary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: SPXSpacing.x2) {
                Text("Try searching for:")
.font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SPXColors.fgMuted)

                ForEach(["Electro swing", "Lo-fi hip hop", "Jazz fusion"], id: \.self) { suggestion in
                    Button(action: {
                        query = suggestion
                        performSearch()
                    }) {
                        Text(suggestion)
                            .font(.system(size: 12))
                            .foregroundColor(SPXColors.accent)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, SPXSpacing.x4)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyResultsView: some View {
        VStack(spacing: SPXSpacing.x3) {
            Spacer()
            Text("No results found")
                .font(.system(size: 14))
                .foregroundColor(SPXColors.fgSecondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Actions
    private func performSearch() {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isLoading = true
        // Search would be performed via the ViewModel
        // For now, simulate loading
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isLoading = false
        }
    }
}

// MARK: - Search Track Row
struct SearchTrackRow: View {
    let track: SpotifyTrack
    let index: Int
    let onPlay: () -> Void

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
                .frame(width: 36, height: 36)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                RoundedRectangle(cornerRadius: 4)
                    .fill(SPXColors.surface)
                    .frame(width: 36, height: 36)
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

            Text(formatTime(track.durationMs ?? 0))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(SPXColors.fgFaint)
        }
        .padding(.vertical, SPXSpacing.x2)
        .contentShape(Rectangle())
        .onTapGesture {
            onPlay()
        }
    }
}

// MARK: - Library Grid View
struct LibraryGridView: View {
    let items: [LibraryItem]
    let onNavigate: (AppView) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: SPXSpacing.x4)], spacing: SPXSpacing.x4) {
            ForEach(items, id: \.id) { item in
                LibraryItemView(item: item)
                    .onTapGesture {
                        handleNavigate(item: item)
                    }
            }
        }
    }

    private func handleNavigate(item: LibraryItem) {
        switch item {
        case .album(let album):
            if let id = album.id {
                onNavigate(AppView.album(id: id, name: album.name))
            }
        case .artist(let artist):
            onNavigate(AppView.artist(id: artist.id, name: artist.name))
        case .playlist(let playlist):
            onNavigate(AppView.playlist(id: playlist.id, name: playlist.name))
        case .track:
            break
        }
    }
}

// MARK: - Library Item
enum LibraryItem: Identifiable {
    case album(SpotifyAlbum)
    case artist(SpotifyArtist)
    case playlist(SpotifyPlaylist)
    case track(SpotifyTrack)

    var id: String {
        switch self {
        case .album(let album): return album.id ?? UUID().uuidString
        case .artist(let artist): return artist.id
        case .playlist(let playlist): return playlist.id
        case .track(let track): return track.id
        }
    }

    var name: String {
        switch self {
        case .album(let album): return album.name
        case .artist(let artist): return artist.name
        case .playlist(let playlist): return playlist.name
        case .track(let track): return track.name
        }
    }

    var imageUrl: String? {
        switch self {
        case .album(let album): return album.images?.first?.url
        case .artist(let artist): return artist.images?.first?.url
        case .playlist(let playlist): return playlist.images?.first?.url
        case .track(let track): return track.album?.images?.first?.url
        }
    }

    var subtitle: String {
        switch self {
        case .album(let album): return album.artists?.map { $0.name }.joined(separator: ", ") ?? ""
        case .artist: return "Artist"
        case .playlist: return "Playlist"
        case .track(let track): return track.artists?.map { $0.name }.joined(separator: ", ") ?? ""
        }
    }
}

// MARK: - Library Item View
struct LibraryItemView: View {
    let item: LibraryItem

    var body: some View {
        VStack(alignment: .leading, spacing: SPXSpacing.x2) {
            // Image
            if let imageUrl = item.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: SPXRadius.sm)
                        .fill(SPXColors.surface)
                        .overlay(
                            ProgressView()
                                .tint(SPXColors.fgMuted)
                        )
                }
                .frame(width: 160, height: 160)
                .clipShape(isCircle ? AnyShape(Circle()) : AnyShape(RoundedRectangle(cornerRadius: SPXRadius.sm)))
            } else {
                RoundedRectangle(cornerRadius: isCircle ? 80 : SPXRadius.sm)
                    .fill(SPXColors.surface)
                    .frame(width: 160, height: 160)
            }

            Text(item.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(SPXColors.fg)
                .lineLimit(1)

            Text(item.subtitle)
                .font(.system(size: 11))
                .foregroundColor(SPXColors.fgFaint)
                .lineLimit(1)
        }
        .frame(width: 160)
    }

    private var isCircle: Bool {
        if case .artist = item { return true }
        return false
    }
}
