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
                    .foregroundColor(isPlaying ? Color.spxAccent : Color.spxTextPrimary)
                    .lineLimit(1)

                Text(artist)
                    .font(.system(size: 11))
                    .foregroundColor(Color.spxTextSecondary)
                    .lineLimit(1)
            }
            .accessibilityElement(children: .combine)

            Spacer()

            // Album name
            if showAlbum {
                Text(album)
                    .font(.system(size: 11))
                    .foregroundColor(Color.spxTextSecondary)
                    .lineLimit(1)
                    .frame(maxWidth: 150, alignment: .leading)
            }

            // Duration
            Text(formatTime(durationMs))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.spxTextSecondary)
                .accessibilityHidden(true)

            // Like button
            Button { } label: {
                IconHeart(filled: isLiked, size: 14)
                    .foregroundColor(isLiked ? Color.spxAccent : Color.spxTextTertiary)
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
            .accessibilityLabel(isLiked ? "Unlike track" : "Like track")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isHovered ? Color.spxOverlay : Color.clear)
        .cornerRadius(4)
        .contentShape(Rectangle())
        .accessibilityLabel("\(title) by \(artist)")
        .accessibilityHint("Double tap to play")
        .accessibilityIdentifier("track-row-\(index ?? 0)")
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
                    .foregroundColor(Color.spxAccent)
            } else {
                Text("\(index ?? 0)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(Color.spxTextTertiary)
                    .frame(width: 20, alignment: .center)
            }
        }
        .frame(width: 24)
    }

    // MARK: - Artwork View

    private var artworkView: some View {
        ZStack {
            ArtworkView(url: artworkUrl, size: .small, shape: .square)
                .accessibilityHidden(true)

            // Play overlay on hover
            if isHovered {
                ZStack {
                    Color.black.opacity(0.4)
                        .frame(width: 32, height: 32)
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                    IconPlay(size: 14)
                        .foregroundColor(Color.spxTextPrimary)
                }
                .accessibilityLabel("Play \(title)")
                .accessibilityHint("Double tap to play")
            }
        }
    }

    // MARK: - Helpers

    private func formatTime(_ millis: Int) -> String {
        let totalSeconds = millis / 1000
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
                .foregroundColor(Color.spxTextTertiary)
                .frame(width: 24, alignment: .center)

            Text("Title")
                .font(.system(size: 11))
                .foregroundColor(Color.spxTextTertiary)

            Spacer()

            Text("Album")
                .font(.system(size: 11))
                .foregroundColor(Color.spxTextTertiary)
                .frame(maxWidth: 150, alignment: .leading)

            Text("Duration")
                .font(.system(size: 11))
                .foregroundColor(Color.spxTextTertiary)
                .frame(width: 50, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

#Preview {
    VStack(spacing: 0) {
        TrackListHeader()
        Divider().background(Color.spxBorder)

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
    .background(Color.spxBase)
}
