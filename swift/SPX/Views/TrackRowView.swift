import SwiftUI

// MARK: - TrackRowView

struct TrackRowView: View {
    var index: Int?
    var artworkUrl: String?
    var title: String = ""
    var artist: String = ""
    var album: String = ""
    var durationMs: Int = 0
    var isPlaying: Bool = false
    var isLiked: Bool = false
    var showIndex: Bool = true
    var showArtwork: Bool = true
    var showAlbum: Bool = true

    @State private var isHovered: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            // Index or Artwork
            if showIndex && !showArtwork {
                indexView
            } else if showArtwork {
                artworkView
            }

            // Title + Artist
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(isPlaying ? SPXColors.accent : SPXColors.fg)
                    .lineLimit(1)

                Text(artist)
                    .font(.system(size: 11))
                    .foregroundColor(SPXColors.fgSecondary)
                    .lineLimit(1)
            }

            Spacer()

            // Album name
            if showAlbum {
                Text(album)
                    .font(.system(size: 11))
                    .foregroundColor(SPXColors.fgSecondary)
                    .lineLimit(1)
                    .frame(maxWidth: 150, alignment: .leading)
            }

            // Duration
            Text(formatTime(durationMs))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(SPXColors.fgSecondary)

            // Like button
            Button(action: {}) {
                IconHeart(filled: isLiked, size: 14)
                    .foregroundColor(isLiked ? SPXColors.accent : SPXColors.fgMuted)
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isHovered ? SPXColors.bgHover : Color.clear)
        .cornerRadius(4)
        .contentShape(Rectangle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }

    // MARK: - Index View

    private var indexView: some View {
        ZStack {
            if isPlaying {
                Image(systemName: "waveform")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 12, height: 12)
                    .foregroundColor(SPXColors.accent)
            } else {
                Text("\(index ?? 0)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(SPXColors.fgMuted)
                    .frame(width: 20, alignment: .center)
            }
        }
        .frame(width: 24)
    }

    // MARK: - Artwork View

    private var artworkView: some View {
        ZStack {
            ArtworkView(url: artworkUrl, size: .small, shape: .square)

            // Play overlay on hover
            if isHovered {
                ZStack {
                    Color.black.opacity(0.5)
                        .frame(width: 32, height: 32)
                        .cornerRadius(6)

                    IconPlay(size: 14)
                        .foregroundColor(SPXColors.fg)
                }
            }
        }
    }

    // MARK: - Helpers

    private func formatTime(_ ms: Int) -> String {
        let totalSeconds = ms / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - TrackListHeader

struct TrackListHeader: View {
    var onSort: ((String) -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            Text("#")
                .font(.system(size: 11))
                .foregroundColor(SPXColors.fgMuted)
                .frame(width: 24, alignment: .center)

            Text("Title")
                .font(.system(size: 11))
                .foregroundColor(SPXColors.fgMuted)

            Spacer()

            Text("Album")
                .font(.system(size: 11))
                .foregroundColor(SPXColors.fgMuted)
                .frame(maxWidth: 150, alignment: .leading)

            Text("Duration")
                .font(.system(size: 11))
                .foregroundColor(SPXColors.fgMuted)
                .frame(width: 50, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

#Preview {
    VStack(spacing: 0) {
        TrackListHeader()
        Divider().background(SPXColors.edge)

        TrackRowView(
            index: 1,
            title: "Bohemian Rhapsody",
            artist: "Queen",
            album: "A Night at the Opera",
            durationMs: 354000,
            isPlaying: true,
            isLiked: true
        )

        TrackRowView(
            index: 2,
            title: "Stairway to Heaven",
            artist: "Led Zeppelin",
            album: "Led Zeppelin IV",
            durationMs: 482000,
            isLiked: false
        )

        TrackRowView(
            index: 3,
            title: "Hotel California",
            artist: "Eagles",
            album: "Hotel California",
            durationMs: 391000,
            isLiked: true
        )
    }
    .frame(width: 600)
    .background(SPXColors.bg)
}
