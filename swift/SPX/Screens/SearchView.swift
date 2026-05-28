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
                .foregroundColor(Color.spxTextPrimary)
                .padding(.top, 24)
                .padding(.bottom, 16)

            // Search Bar
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(Color.spxTextTertiary)
                    .font(.system(size: 14))

                TextField("What do you want to listen to?", text: $query)
                    .font(.system(size: 13))
                    .foregroundColor(Color.spxTextPrimary)
                    .tint(Color.spxAccent)
                    .onSubmit {
                        performSearch()
                    }
                    .accessibilityIdentifier("search-textfield")

                Button(action: performSearch) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Color.spxTextSecondary)
                        .font(.system(size: 16))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search")
                .accessibilityIdentifier("search-submit-button")
            }
            .padding(12)
            .background(Color.spxElevated)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.spxBorder, lineWidth: 1)
            )
            .padding(.bottom, 16)

            // Filter Tabs
            if results != nil {
                HStack(spacing: 8) {
                    ForEach(SearchFilter.allCases, id: \.self) { filter in
                        Button(action: { selectedFilter = filter }) {
                            Text(filter.rawValue)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(selectedFilter == filter ? Color.spxTextPrimary : Color.spxTextTertiary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(selectedFilter == filter ? Color.spxElevated : Color.clear)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(selectedFilter == filter ? Color.spxBorder : Color.clear, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(filter.rawValue)
                        .accessibilityIdentifier("search-filter-\(filter.rawValue.lowercased())")
                    }
                }
                .padding(.bottom, 16)
            }

            // Content
            if isLoading {
                Spacer()
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.spxAccent)
                    Spacer()
                }
                Spacer()
            } else if let results = results {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 40) {
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
                .scrollIndicators(.hidden)
            } else {
                emptyStateView
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
        .background(Color.spxBase)
        .accessibilityIdentifier("search-view")
    }

    // MARK: - All Results View
    @ViewBuilder
    private func allResultsView(_ results: SpotifySearchResults) -> some View {
        if let tracks = results.tracks?.items, !tracks.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Tracks")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color.spxTextPrimary)

                ForEach(Array(tracks.prefix(5).enumerated()), id: \.element.id) { index, track in
                    SearchTrackRow(track: track, index: index, onPlay: { onPlayTrack(track) })
                }
            }
        }

        if let albums = results.albums?.items, !albums.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Albums")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color.spxTextPrimary)

                LibraryGridView(items: albums.map { LibraryItem.album($0) }, onNavigate: onNavigate)
            }
        }

        if let artists = results.artists?.items, !artists.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Artists")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color.spxTextPrimary)

                LibraryGridView(items: artists.map { LibraryItem.artist($0) }, onNavigate: onNavigate)
            }
        }

        if let playlists = results.playlists?.items, !playlists.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Playlists")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Color.spxTextPrimary)

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
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(Color.spxTextTertiary.opacity(0.5))

            Text("Search for songs, albums, artists, or playlists")
                .font(.system(size: 14))
                .foregroundColor(Color.spxTextSecondary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 8) {
                Text("Try searching for:")
.font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color.spxTextTertiary)

                ForEach(["Electro swing", "Lo-fi hip hop", "Jazz fusion"], id: \.self) { suggestion in
                    Button(action: {
                        query = suggestion
                        performSearch()
                    }) {
                        Text(suggestion)
                            .font(.system(size: 12))
                            .foregroundColor(Color.spxAccent)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 16)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyResultsView: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("No results found")
                .font(.system(size: 14))
                .foregroundColor(Color.spxTextSecondary)
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
                .frame(width: 36, height: 36)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.spxElevated)
                    .frame(width: 36, height: 36)
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

            Text(String.formatDuration(millis: track.durationMs ?? 0))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.spxTextTertiary)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .onTapGesture {
            onPlay()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(track.name) by \(track.artists?.compactMap { $0.name }.joined(separator: ", ") ?? "")")
        .accessibilityHint("Double tap to play")
        .accessibilityIdentifier("search-track-row-\(index)")
    }
}

// MARK: - Library Grid View
struct LibraryGridView: View {
    let items: [LibraryItem]
    let onNavigate: (AppView) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 16)], spacing: 16) {
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
            onNavigate(AppView.artist(id: artist.id, name: artist.name ?? ""))
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
        case .album(let album): return album.name ?? ""
        case .artist(let artist): return artist.name ?? ""
        case .playlist(let playlist): return playlist.name ?? ""
        case .track(let track): return track.name ?? ""
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
        case .album(let album): return album.artists?.compactMap { $0.name }.joined(separator: ", ") ?? ""
        case .artist: return "Artist"
        case .playlist: return "Playlist"
        case .track(let track): return track.artists?.compactMap { $0.name }.joined(separator: ", ") ?? ""
        }
    }
}

// MARK: - Library Item View
struct LibraryItemView: View {
    let item: LibraryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Image
            if let imageUrl = item.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.spxElevated)
                        .overlay(
                            ProgressView()
                                .tint(Color.spxTextTertiary)
                        )
                }
                .frame(width: 160, height: 160)
                .clipShape(isCircle ? AnyShape(Circle()) : AnyShape(RoundedRectangle(cornerRadius: 4)))
            } else {
                RoundedRectangle(cornerRadius: isCircle ? 80 : 4)
                    .fill(Color.spxElevated)
                    .frame(width: 160, height: 160)
            }

            Text(item.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color.spxTextPrimary)
                .lineLimit(1)

            Text(item.subtitle)
                .font(.system(size: 11))
                .foregroundColor(Color.spxTextTertiary)
                .lineLimit(1)
        }
        .frame(width: 160)
    }

    private var isCircle: Bool {
        if case .artist = item { return true }
        return false
    }
}
