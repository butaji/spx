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
        .background(Color.spxBase)
    }

    // MARK: - Artist Hero View
    private var artistHeroView: some View {
        HStack(alignment: .bottom, spacing: 32) {
            // Artist Image
            if let imageUrl = artist?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url, content: { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                }, placeholder: {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.spxElevated)
                        .overlay(
                            ProgressView()
                                .tint(Color.spxTextTertiary)
                        )
                })
                .frame(width: 80, height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.spxElevated)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.spxBorder, lineWidth: 1)
                    )
                    .frame(width: 80, height: 80)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 64))
                            .foregroundColor(Color.spxTextTertiary)
                    )
            }

            // Artist Info
            VStack(alignment: .leading, spacing: 12) {
                Text("Artist")
                    .font(.system(size: 12))
                    .foregroundColor(Color.spxTextTertiary)
                    .textCase(.uppercase)
                    .tracking(0.1)

                Text(artist?.name ?? "Unknown Artist")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(Color.spxTextPrimary)
                    .lineLimit(1)

                // Meta info
                HStack(spacing: 8) {
                    Text("\(formatFollowers(artist?.followers?.total ?? 0)) followers")
                        .font(.system(size: 13))
                        .foregroundColor(Color.spxTextTertiary)

                    if let genres = artist?.genres, !genres.isEmpty {
                        Text("·")
                            .foregroundColor(Color.spxTextTertiary)

                        Text(genres.prefix(3).joined(separator: ", "))
                            .font(.system(size: 13))
                            .foregroundColor(Color.spxAccent)
                    }
                }

                // Popularity
                if let popularity = artist?.popularity {
                    HStack(spacing: 12) {
                        Text("Popularity")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color.spxTextTertiary)
                            .textCase(.uppercase)
                            .tracking(0.05)

                        // Progress Bar
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.spxElevated)
                                    .frame(height: 5)

                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.spxAccent)
                                    .frame(
                                        width: geometry.size.width * CGFloat(popularity)
                                            / 100,
                                        height: 5
                                    )
                            }
                        }
                        .frame(width: 120, height: 5)

                        Text("\(popularity)%")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color.spxTextTertiary)
                    }
                }

                // Play Button
                Button(action: onPlayTopTracks) {
                    HStack(spacing: 8) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 18))
                        Text("Play")
                    }
                    .foregroundColor(.black)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.spxAccent)
                    .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Play popular tracks")
                .accessibilityIdentifier("play-artist-button")
                .padding(.top, 8)
            }

            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
        .padding(.bottom, 24)
    }

    // MARK: - Loading View
    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView()
                .tint(Color.spxAccent)
            Spacer()
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    // MARK: - Content View
    private var contentView: some View {
        VStack(alignment: .leading, spacing: 40) {
            // Popular Tracks Section
            if !topTracks.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Popular")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(Color.spxTextPrimary)
                        .padding(.horizontal, 24)

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
                    .padding(.horizontal, 24)
                }
            }

            // Discography Section
            if !albums.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Discography")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(Color.spxTextPrimary)
                        .padding(.horizontal, 24)

                    let columns = [
                        GridItem(
                            .adaptive(minimum: 160),
                            spacing: 16
                        )
                    ]
                    LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(albums, id: \.id) { album in
                            ArtistAlbumView(album: album)
                                .onTapGesture {
                                    onPlayContext("spotify:album:\(album.id)")
                                }
                        }
                    }
                    .padding(.horizontal, 24)
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
        HStack(spacing: 12) {
            Text("\(index + 1)")
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(Color.spxTextTertiary)
                .frame(width: 36, alignment: .center)

            // Artwork
            if let imageUrl = track.album?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url, content: { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                }, placeholder: {
                    RoundedRectangle(cornerRadius: 4).fill(Color.spxElevated)
                })
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

                Text(track.album?.name ?? "")
                    .font(.system(size: 11))
                    .foregroundColor(Color.spxTextTertiary)
                    .lineLimit(1)
            }

            Spacer()

            // Play button on hover
            Button(action: onTap) {
                Image(systemName: "play.fill")
                    .font(.system(size: 12))
                    .foregroundColor(isHovered ? .black : Color.spxTextSecondary)
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
            .frame(width: 28, height: 28)
            .background(isHovered ? Color.spxAccent : Color.clear)
            .clipShape(Circle())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(isHovered ? Color.white.opacity(0.04) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(track.name) from \(track.album?.name ?? "unknown album")")
        .accessibilityHint("Double tap to play")
        .accessibilityIdentifier("artist-track-row-\(index)")
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
        VStack(alignment: .leading, spacing: 8) {
            // Album Artwork
            if let imageUrl = album.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url, content: { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                }, placeholder: {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.spxElevated)
                        .overlay(
                            ProgressView()
                                .tint(Color.spxTextTertiary)
                        )
                })
                .frame(width: 160, height: 160)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.spxElevated)
                    .frame(width: 160, height: 160)
            }

            Text(album.name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color.spxTextPrimary)
                .lineLimit(1)

            Text("\(album.albumType) · \(album.releaseDate?.prefix(4).description ?? "")")
                .font(.system(size: 11))
                .foregroundColor(Color.spxTextTertiary)
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
