import SwiftUI

// MARK: - Album Detail View
struct AlbumDetailView: View {
    let album: SpotifyAlbum?
    let isLoading: Bool
    let onPlayContext: (String) -> Void
    let onPlayTrack: (Int) -> Void
    let onNavigateToArtist: (String, String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero Section
                albumHeroView

                // Track List
                if isLoading {
                    loadingView
                } else {
                    trackListView
                }
            }
            .padding(.bottom, 100)
        }
        .background(SPXColors.bg)
    }

    // MARK: - Album Hero View
    private var albumHeroView: some View {
        HStack(alignment: .top, spacing: SPXSpacing.x6) {
            // Album Artwork
            if let imageUrl = album?.images?.first?.url, let url = URL(string: imageUrl) {
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
                .frame(width: 240, height: 240)
                .clipShape(RoundedRectangle(cornerRadius: SPXRadius.sm))
                .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
            } else {
                RoundedRectangle(cornerRadius: SPXRadius.sm)
                    .fill(SPXColors.surface)
                    .frame(width: 240, height: 240)
                    .overlay(
                        Image(systemName: "music.note")
                            .font(.system(size: 48))
                            .foregroundColor(SPXColors.fgMuted)
                    )
            }

            // Album Info
            VStack(alignment: .leading, spacing: SPXSpacing.x2) {
                Text("Album")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SPXColors.fgFaint)
                    .textCase(.uppercase)
                    .tracking(0.1)

                Text(album?.name ?? "Unknown Album")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(SPXColors.fg)
                    .lineLimit(2)

                // Artist
                if let artist = album?.artists?.first {
                    Button(action: {
                        onNavigateToArtist(artist.id, artist.name)
                    }) {
                        Text(artist.name)
                            .font(.system(size: 14))
                            .foregroundColor(SPXColors.fgSecondary)
                    }
                    .buttonStyle(.plain)
                }

                // Year & Tracks
                HStack(spacing: SPXSpacing.x2) {
                    Text(album?.releaseDate?.prefix(4).description ?? "")
                        .font(.system(size: 13))
                        .foregroundColor(SPXColors.fgMuted)

                    Text("·")
                        .foregroundColor(SPXColors.fgFaint)

                    Text("\(album?.tracks?.items.count ?? 0) tracks")
                        .font(.system(size: 13))
                        .foregroundColor(SPXColors.fgMuted)
                }

                // Play Button
                Button(action: {
                    if let uri = album?.uri {
                        onPlayContext(uri)
                    }
                }) {
                    HStack(spacing: SPXSpacing.x2) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 18))
                        Text("Play")
                    }
                    .foregroundColor(.black)
                    .padding(.horizontal, SPXSpacing.x5)
                    .padding(.vertical, SPXSpacing.x3)
                    .background(SPXColors.accent)
                    .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(.top, SPXSpacing.x4)
            }
        }
        .padding(.horizontal, SPXSpacing.x6)
        .padding(.top, SPXSpacing.x4)
        .padding(.bottom, SPXSpacing.x6)
    }

    // MARK: - Loading View
    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView()
                .tint(SPXColors.accent)
            Spacer()
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    // MARK: - Track List View
    private var trackListView: some View {
        LazyVStack(spacing: 0) {
            // Group tracks by disc if multiple discs
            let tracks = album?.tracks?.items ?? []
            let discGroups = Dictionary(grouping: tracks) { $0.discNumber ?? 1 }

            if discGroups.count > 1 {
                // Multi-disc album
                ForEach(discGroups.keys.sorted(), id: \.self) { discNumber in
                    if let discTracks = discGroups[discNumber] {
                        VStack(alignment: .leading, spacing: 0) {
                            // Disc Header
                            Text("Disc \(discNumber)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(SPXColors.fgSecondary)
                                .padding(.horizontal, SPXSpacing.x6)
                                .padding(.vertical, SPXSpacing.x2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(SPXColors.surface)

                            // Tracks
                            ForEach(Array((discTracks).enumerated()), id: \.element.id) { index, track in
                                AlbumTrackRow(
                                    track: track,
                                    index: track.trackNumber ?? (index + 1),
                                    artworkUrl: album?.images?.first?.url,
                                    onTap: {
                                        if let trackIndex = tracks.firstIndex(where: { $0.id == track.id }) {
                                            onPlayTrack(trackIndex)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            } else {
                // Single disc album
                ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                    AlbumTrackRow(
                        track: track,
                        index: track.trackNumber ?? (index + 1),
                        artworkUrl: album?.images?.first?.url,
                        onTap: {
                            onPlayTrack(index)
                        }
                    )
                }
            }
        }
        .padding(.horizontal, SPXSpacing.x6)
    }
}

// MARK: - Album Track Row
struct AlbumTrackRow: View {
    let track: SpotifyTrack
    let index: Int
    let artworkUrl: String?
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: SPXSpacing.x3) {
            Text("\(index)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(SPXColors.fgFaint)
                .frame(width: 32, alignment: .center)

            // Artwork
            if let imageUrl = artworkUrl, let url = URL(string: imageUrl) {
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
        .padding(.horizontal, SPXSpacing.x2)
        .padding(.vertical, SPXSpacing.x2)
        .background(isHovered ? SPXColors.bgHover : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: SPXRadius.sm))
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onTap()
        }
    }
}
