import SwiftUI

struct HomeView: View {
    let track: TrackInfo?
    let isPlaying: Bool
    let liked: Bool
    let artistDetail: SpotifyArtist?
    let tags: [String]
    let playlists: [PlaylistItem]
    let userName: String
    let userImage: String?
    let artistListenCount: Int
    let trackListenCount: Int
    let onToggleLike: () -> Void

    // MARK: - Hover States
    @State private var isHoveringHeart = false
    @State private var isHoveringDownload = false
    @State private var isHoveringShare = false
    @State private var isHoveringProgress = false
    @State private var isHoveringArtist = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroSection
                statsSection
                tagsSection
                artistSection(artist: artistDetail)
                playlistsSection
            }
        }
        .scrollIndicators(.hidden)
        .background(Color.spxBase)
        .accessibilityIdentifier("home-scroll-view")
    }

    // MARK: - Hero Section
    private var heroSection: some View {
        HStack(alignment: .top, spacing: 24) {
            // Album art with elevation
            Group {
                if let urlString = track?.imageUrl, let url = URL(string: urlString) {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        artPlaceholder
                    }
                } else {
                    artPlaceholder
                }
            }
            .frame(width: 280, height: 280)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: .black.opacity(0.2), radius: 32, x: 0, y: 16)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )

            // Metadata column
            VStack(alignment: .leading, spacing: 6) {
                Text(track?.name ?? "Nothing playing")
                    .font(.system(size: 32, weight: .bold, design: .default))
                    .tracking(-0.02)
                    .foregroundColor(.spxTextPrimary)

                Text(track?.artist ?? "Unknown Artist")
                    .font(.system(size: 14))
                    .foregroundColor(.spxTextSecondary)

                if let album = track?.album {
                    Text(album)
                        .font(.system(size: 12))
                        .foregroundColor(.spxTextTertiary)
                }

                // Progress bar
                HStack(spacing: 8) {
                    Text(formatTime(track?.progressMs ?? 0))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.spxTextTertiary)

                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.spxBorder).frame(height: 4)
                            Capsule().fill(Color.spxAccent).frame(
                                width: g.size.width * progressValue,
                                height: 4
                            )
                            // Thumb handle
                            Circle()
                                .fill(.white)
                                .frame(width: isHoveringProgress ? 12 : 0, height: isHoveringProgress ? 12 : 0)
                                .offset(x: g.size.width * progressValue - 6)
                                .animation(.easeOut(duration: 0.15), value: isHoveringProgress)
                        }
                    }
                    .frame(height: 4)
                    .onHover { isHoveringProgress = $0 }

                    Text(formatTime(track?.durationMs ?? 0))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.spxTextTertiary)
                }
                .frame(width: 320)
                .padding(.top, 4)

                // Action buttons with hover animations
            HStack(alignment: .top, spacing: 16) {
                    Button(action: onToggleLike) {
                        Image(systemName: liked ? "heart.fill" : "heart")
                            .font(.system(size: 20, weight: .regular))
                            .scaleEffect(isHoveringHeart ? 1.15 : 1.0)
                            .brightness(isHoveringHeart ? 0.2 : 0)
                    }
                    .buttonStyle(.plain)
                    .onHover { isHoveringHeart = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringHeart)
                    .accessibilityLabel(liked ? "Unlike" : "Like")
                    .accessibilityIdentifier("home-like-button")

                    Button(action: {}) {
                        Image(systemName: "arrow.down.circle")
                            .font(.system(size: 20, weight: .regular))
                            .scaleEffect(isHoveringDownload ? 1.15 : 1.0)
                            .brightness(isHoveringDownload ? 0.2 : 0)
                    }
                    .buttonStyle(.plain)
                    .onHover { isHoveringDownload = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringDownload)
                    .accessibilityLabel("Download")
                    .accessibilityIdentifier("home-download-button")

                    Button(action: {}) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 20, weight: .regular))
                            .scaleEffect(isHoveringShare ? 1.15 : 1.0)
                            .brightness(isHoveringShare ? 0.2 : 0)
                    }
                    .buttonStyle(.plain)
                    .onHover { isHoveringShare = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringShare)
                    .accessibilityLabel("Share")
                    .accessibilityIdentifier("home-share-button")
                }
                .foregroundColor(.spxTextSecondary)
                .padding(.top, 8)
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
    }

    private var artPlaceholder: some View {
        RoundedRectangle(cornerRadius: 20)
            .fill(Color.spxOverlay)
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: 48))
                    .foregroundColor(.spxTextTertiary)
            )
    }

    private var progressValue: Double {
        guard let track = track, track.durationMs > 0 else { return 0 }
        return Double(track.progressMs) / Double(track.durationMs)
    }

    private func formatTime(_ millis: Int) -> String {
        let totalSeconds = millis / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    // MARK: - Stats Section
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Triangle()
                .fill(Color.spxOverlay)
                .frame(width: 12, height: 6)
                .padding(.leading, 24)

            Group {
                if let track = track, !primaryArtist.isEmpty, !track.name.isEmpty {
                    (Text("You've listened to ")
                        .foregroundColor(Color.spxTextSecondary)
                    + Text(primaryArtist).bold()
                    + Text(" \(artistListenCount) times and ")
                        .foregroundColor(Color.spxTextSecondary)
                    + Text(track.name).bold()
                    + Text(" \(trackListenCount) times.")
                        .foregroundColor(Color.spxTextSecondary))
                    .font(.system(size: 14))
                } else {
                    Text("You've listened to 0 times and 0 times.")
                        .font(.system(size: 14))
                        .foregroundColor(Color.spxTextSecondary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .background(.thinMaterial)
            .cornerRadius(16)
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
    }

    private var primaryArtist: String {
        guard let artist = track?.artist else { return "0" }
        return artist.components(separatedBy: ",").first ?? artist
    }

    // MARK: - Tags Section
    private var tagsSection: some View {
        HStack(spacing: 6) {
            Text("Popular tags:")
                .foregroundColor(.spxTextTertiary)
                .font(.system(size: 12))

            if tags.isEmpty {
                Text("electro swing")
                    .foregroundColor(.spxAccent)
                    .font(.system(size: 12))
                Text("·")
                    .foregroundColor(.spxTextTertiary)
                    .font(.system(size: 12))
                Text("trip hop")
                    .foregroundColor(.spxAccent)
                    .font(.system(size: 12))
            } else {
                ForEach(Array(tags.enumerated()), id: \.element) { index, tag in
                    if index > 0 {
                        Text("·")
                            .foregroundColor(.spxTextTertiary)
                            .font(.system(size: 12))
                    }
                    Text(tag)
                        .foregroundColor(.spxAccent)
                        .font(.system(size: 12))
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
    }

    // MARK: - Artist Section
    private func artistSection(artist: SpotifyArtist?) -> some View {
        let name = artist?.name ?? "Mr. Scruff"
        let followers = formatFollowers(artist?.followers?.total ?? 175_608)
        return VStack(alignment: .leading, spacing: 16) {
            Text(name)
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.white)
                .opacity(isHoveringArtist ? 1.0 : 0.9)

            HStack(alignment: .top, spacing: 16) {
                Group {
                    if let urlString = artist?.images?.first?.url, let url = URL(string: urlString) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            artistPlaceholder
                        }
                    } else {
                        artistPlaceholder
                    }
                }
                .frame(width: 80, height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .black.opacity(0.15), radius: 16, x: 0, y: 8)
                .scaleEffect(isHoveringArtist ? 1.05 : 1.0)
                .animation(.easeOut(duration: 0.2), value: isHoveringArtist)

                (Text("\(name) is a musical artist on Spotify. They have \(followers) followers. ")
                    .foregroundColor(Color.spxTextSecondary)
                + Text("View more on SPX")
                    .foregroundColor(Color.spxAccent))
                .font(.system(size: 14))
            }
            .onHover { isHoveringArtist = $0 }
        }
        .padding(.horizontal, 24)
        .padding(.top, 32)
    }

    private var artistPlaceholder: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(Color.spxOverlay)
            .overlay(
                Image(systemName: "person.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.spxTextTertiary)
            )
    }

    // MARK: - Playlists Section
    private var playlistsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your Playlists")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.spxTextPrimary)

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 160, maximum: 160), spacing: 16)],
                alignment: .leading,
                spacing: 16
            ) {
                if playlists.isEmpty {
                    ForEach(0..<4) { _ in
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.spxOverlay)
                            .frame(width: 160, height: 160)
                    }
                } else {
                    ForEach(playlists) { playlist in
                        PlaylistCardView(name: playlist.name, imageUrl: playlist.image)
                            .frame(width: 160, height: 160)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
    }

    private func formatFollowers(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.1fM", Double(count) / 1_000_000)
        } else if count >= 1_000 {
            return String(format: "%.1fK", Double(count) / 1_000)
        }
        return "\(count)"
    }
}

// MARK: - Triangle Shape
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
