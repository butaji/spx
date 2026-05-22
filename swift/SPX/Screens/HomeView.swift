import SwiftUI

struct HomeView: View {
    let track: TrackInfo?
    let isPlaying: Bool
    let liked: Bool
    let artistDetail: SpotifyArtist?
    let artistTopTracks: [SpotifyTrack]
    let tags: [String]
    let playlists: [PlaylistItem]
    let userName: String
    let userImage: String?
    let onToggleLike: () -> Void
    let onPlayTrack: (SpotifyTrack) -> Void
    let onNavigate: (AppView) -> Void

    private let accent = Color(hex: "#1DB954")
    private let accentSubtle = Color(hex: "1DB954").opacity(0.1)
    private let fgSecondary = Color(hex: "#a0a0a0")
    private let fgMuted = Color(hex: "#666666")
    private let surface = Color(hex: "#1a1a1a")
    private let edge = Color(hex: "#333333")
    private let bgElevated = Color(hex: "#111111")

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Hero Section - always visible
                heroSection

                // Stats Section - always visible with placeholder if no track
                statsSection

                // Tags Section
                if !tags.isEmpty {
                    tagsSection
                }

                // Artist Section
                if let artist = artistDetail {
                    artistSection(artist: artist)
                }

                // Playlists Section - always visible
                playlistsSection
            }
            .padding(EdgeInsets(top: 16, leading: 24, bottom: 28, trailing: 28))
        }
        .background(Color(hex: "#0a0a0a"))
    }

    private var heroSection: some View {
        HStack(spacing: 32) {
            // Artwork - placeholder if no track
            Group {
                if let urlString = track?.imageUrl, let url = URL(string: urlString) {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        placeholderArtwork
                    }
                } else {
                    placeholderArtwork
                }
            }
            .frame(width: 160, height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Info
            VStack(alignment: .leading, spacing: 6) {
                Text(track?.name ?? "Nothing playing")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(Color(hex: "#f5f5f5"))
                    .tracking(-0.02)
                    .lineLimit(2)

                Text(track?.artist ?? "Unknown Artist")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgSecondary)

                if let album = track?.album {
                    Text(album)
                        .font(.system(size: 14))
                        .foregroundColor(fgMuted)
                }

                Spacer()

                // Action buttons
                HStack(spacing: 12) {
                    Button(action: onToggleLike) {
                        Image(systemName: liked ? "heart.fill" : "heart")
                            .font(.system(size: 20))
                            .foregroundColor(liked ? accent : fgSecondary)
                            .frame(width: 40, height: 40)
                            .background(surface)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(edge, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    Button(action: {}) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 20))
                            .foregroundColor(fgSecondary)
                            .frame(width: 40, height: 40)
                            .background(surface)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(edge, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    Button(action: {}) {
                        Image(systemName: "link")
                            .font(.system(size: 20))
                            .foregroundColor(fgSecondary)
                            .frame(width: 40, height: 40)
                            .background(surface)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(edge, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var statsSection: some View {
        Group {
            if let track = track {
                Text("You've listened to **\(track.artist)** 422 times and **\(track.name)** 7 times.")
                    .font(.system(size: 14))
                    .foregroundColor(Color(hex: "#f5f5f5"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(bgElevated)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                Text("Start playing music to see your stats here.")
                    .font(.system(size: 14))
                    .foregroundColor(fgMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(bgElevated)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tags")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(Color(hex: "#f5f5f5"))

            HStack(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 3)
                        .background(accentSubtle)
                        .clipShape(Capsule())
                }
            }
        }
    }

    private func artistSection(artist: SpotifyArtist) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(artist.name)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(Color(hex: "#f5f5f5"))

            HStack(spacing: 16) {
                Group {
                    if let urlString = artist.images?.first?.url, let url = URL(string: urlString) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Color(hex: "#1a1a1a")
                        }
                    } else {
                        Color(hex: "#1a1a1a")
                    }
                }
                .frame(width: 120, height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 8) {
                    Text("\(artist.name) is a musical artist on Spotify. " +
                        "They have \(formatFollowers(artist.followers?.total ?? 0)) followers.")
                        .font(.system(size: 14))
                        .foregroundColor(fgSecondary)
                        .lineLimit(3)

                    Text("View more on SPX")
                        .font(.system(size: 14))
                        .foregroundColor(accent)
                }

                Spacer()
            }
        }
    }

    private var playlistsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your Playlists")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(Color(hex: "#f5f5f5"))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    // User avatar
                    VStack(alignment: .leading, spacing: 8) {
                        Group {
                            if let urlString = userImage, let url = URL(string: urlString) {
                                AsyncImage(url: url) { image in
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    Circle()
                                        .fill(surface)
                                        .overlay(
                                            Image(systemName: "person.fill")
                                                .font(.system(size: 24))
                                                .foregroundColor(fgMuted)
                                        )
                                }
                            } else {
                                Circle()
                                    .fill(surface)
                                    .overlay(
                                        Image(systemName: "person.fill")
                                            .font(.system(size: 24))
                                            .foregroundColor(fgMuted)
                                    )
                            }
                        }
                        .frame(width: 60, height: 60)
                        .clipShape(Circle())

                        Text(userName)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Color(hex: "#f5f5f5"))
                            .lineLimit(1)
                    }
                    .frame(width: 80)

                    // Playlist items
                    ForEach(playlists, id: \.id) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Group {
                                if let urlString = item.image, let url = URL(string: urlString) {
                                    AsyncImage(url: url) { image in
                                        image.resizable().aspectRatio(contentMode: .fill)
                                    } placeholder: {
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(surface)
                                    }
                                } else {
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(surface)
                                }
                            }
                            .frame(width: 160, height: 100)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(edge, lineWidth: 1)
                            )

                            Text(item.name)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(Color(hex: "#f5f5f5"))
                                .lineLimit(1)
                        }
                        .frame(width: 160)
                    }
                }
            }
        }
    }

    private var placeholderArtwork: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(surface)
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: 48))
                    .foregroundColor(fgMuted)
            )
    }

    private func formatFollowers(_ count: Int) -> String {
        if count >= 1000000 {
            return String(format: "%.1fM", Double(count) / 1000000)
        } else if count >= 1000 {
            return String(format: "%.1fK", Double(count) / 1000)
        }
        return "\(count)"
    }
}

struct PlaylistItem: Identifiable {
    let id: String
    let name: String
    let image: String?
}
