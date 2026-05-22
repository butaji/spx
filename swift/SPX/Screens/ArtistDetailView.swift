import SwiftUI

func formatFollowers(_ count: Int) -> String {
    if count >= 1_000_000 {
        return String(format: "%.1fM", Double(count) / 1_000_000)
    } else if count >= 1_000 {
        return String(format: "%.1fK", Double(count) / 1_000)
    } else {
        return "\(count)"
    }
}

// MARK: - Artist Detail View
struct ArtistDetailView: View {
    let artist: SpotifyArtist?
    let topTracks: [SpotifyTrack]
    let albums: [ArtistAlbum]
    let isLoading: Bool
    let onPlayTopTracks: () -> Void
    let onPlayTrack: (SpotifyTrack) -> Void
    let onPlayContext: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero Section
                artistHeroView

                // Content
                if isLoading {
                    loadingView
                } else {
                    contentView
                }
            }
            .padding(.bottom, 100)
        }
        .background(SPXColors.bg)
    }

    // MARK: - Artist Hero View
    private var artistHeroView: some View {
        HStack(alignment: .bottom, spacing: SPXSpacing.x7) {
            // Artist Image (Round)
            if let imageUrl = artist?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle()
                        .fill(SPXColors.surface)
                        .overlay(
                            ProgressView()
                                .tint(SPXColors.fgMuted)
                        )
                }
                .frame(width: 240, height: 240)
                .clipShape(Circle())
                .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
            } else {
                Circle()
                    .fill(SPXColors.surface)
                    .frame(width: 240, height: 240)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 64))
                            .foregroundColor(SPXColors.fgMuted)
                    )
            }

            // Artist Info
            VStack(alignment: .leading, spacing: SPXSpacing.x3) {
                Text("Artist")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SPXColors.fgFaint)
                    .textCase(.uppercase)
                    .tracking(0.1)

                Text(artist?.name ?? "Unknown Artist")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(SPXColors.fg)
                    .lineLimit(1)

                // Meta info
                HStack(spacing: SPXSpacing.x2) {
                    Text("\(formatFollowers(artist?.followers?.total ?? 0)) followers")
                        .font(.system(size: 13))
                        .foregroundColor(SPXColors.fgMuted)

                    if let genres = artist?.genres, !genres.isEmpty {
                        Text("·")
                            .foregroundColor(SPXColors.fgFaint)

                        Text(genres.prefix(3).joined(separator: ", "))
                            .font(.system(size: 13))
                            .foregroundColor(SPXColors.accent)
                    }
                }

                // Popularity
                if let popularity = artist?.popularity {
                    HStack(spacing: SPXSpacing.x3) {
                        Text("Popularity")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(SPXColors.fgFaint)
                            .textCase(.uppercase)
                            .tracking(0.05)

                        // Progress Bar
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(SPXColors.bgElevated)
                                    .frame(height: 5)

                                RoundedRectangle(cornerRadius: 3)
                                    .fill(SPXColors.accent)
                                    .frame(width: geometry.size.width * CGFloat(popularity) / 100, height: 5)
                            }
                        }
                        .frame(width: 120, height: 5)

                        Text("\(popularity)%")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(SPXColors.fgMuted)
                    }
                }

                // Play Button
                Button(action: onPlayTopTracks) {
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
                .padding(.top, SPXSpacing.x2)
            }

            Spacer()
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

    // MARK: - Content View
    private var contentView: some View {
        VStack(alignment: .leading, spacing: SPXSpacing.x8) {
            // Popular Tracks Section
            if !topTracks.isEmpty {
                VStack(alignment: .leading, spacing: SPXSpacing.x4) {
                    Text("Popular")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(SPXColors.fg)
                        .padding(.horizontal, SPXSpacing.x6)

                    LazyVStack(spacing: 0) {
                        ForEach(Array(topTracks.enumerated()), id: \.element.id) { index, track in
                            ArtistTrackRow(
                                track: track,
                                index: index,
                                onTap: {
                                    onPlayTrack(track)
                                }
                            )
                        }
                    }
                    .padding(.horizontal, SPXSpacing.x6)
                }
            }

            // Discography Section
            if !albums.isEmpty {
                VStack(alignment: .leading, spacing: SPXSpacing.x4) {
                    Text("Discography")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(SPXColors.fg)
                        .padding(.horizontal, SPXSpacing.x6)

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: SPXSpacing.x4)], spacing: SPXSpacing.x4) {
                        ForEach(albums, id: \.id) { album in
                            ArtistAlbumView(album: album)
                                .onTapGesture {
                                    onPlayContext("spotify:album:\(album.id)")
                                }
                        }
                    }
                    .padding(.horizontal, SPXSpacing.x6)
                }
            }
        }
    }
}

// MARK: - Artist Track Row
struct ArtistTrackRow: View {
    let track: SpotifyTrack
    let index: Int
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: SPXSpacing.x3) {
            Text("\(index + 1)")
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(SPXColors.fgFaint)
                .frame(width: 36, alignment: .center)

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

                Text(track.album?.name ?? "")
                    .font(.system(size: 11))
                    .foregroundColor(SPXColors.fgFaint)
                    .lineLimit(1)
            }

            Spacer()

            // Play button on hover
            Button(action: onTap) {
                Image(systemName: "play.fill")
                    .font(.system(size: 12))
                    .foregroundColor(isHovered ? .black : SPXColors.fgSecondary)
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
            .frame(width: 28, height: 28)
            .background(isHovered ? SPXColors.accent : Color.clear)
            .clipShape(Circle())
        }
        .padding(.horizontal, SPXSpacing.x4)
        .padding(.vertical, SPXSpacing.x2)
        .background(isHovered ? Color.white.opacity(0.04) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: SPXRadius.sm))
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onTap()
        }
    }
}

// MARK: - Artist Album View
struct ArtistAlbumView: View {
    let album: ArtistAlbum

    var body: some View {
        VStack(alignment: .leading, spacing: SPXSpacing.x2) {
            // Album Artwork
            if let imageUrl = album.images?.first?.url, let url = URL(string: imageUrl) {
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
                .clipShape(RoundedRectangle(cornerRadius: SPXRadius.sm))
            } else {
                RoundedRectangle(cornerRadius: SPXRadius.sm)
                    .fill(SPXColors.surface)
                    .frame(width: 160, height: 160)
            }

            Text(album.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(SPXColors.fg)
                .lineLimit(1)

            Text("\(album.albumType) · \(album.releaseDate?.prefix(4).description ?? "")")
                .font(.system(size: 11))
                .foregroundColor(SPXColors.fgFaint)
                .lineLimit(1)
        }
        .frame(width: 160)
    }
}

// MARK: - Artist Album Model
struct ArtistAlbum: Identifiable {
    let id: String
    let name: String
    let images: [SpotifyImage]?
    let albumType: String
    let releaseDate: String?
}
