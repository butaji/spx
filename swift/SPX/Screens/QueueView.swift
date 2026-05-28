import SwiftUI

// MARK: - Queue View
struct QueueView: View {
    let currentTrack: SpotifyTrack?
    let queue: [SpotifyTrack]
    let onPlayUris: ([String], Int?) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Screen Title
            Text("Up Next")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(Color.spxTextPrimary)
                .padding(.top, 24)
                .padding(.bottom, 24)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    // Now Playing Section
                    if let current = currentTrack {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Now Playing")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color.spxTextTertiary)
                                .textCase(.uppercase)
                                .tracking(0.1)

                            QueueItemView(
                                track: current,
                                index: 0,
                                isCurrentlyPlaying: true,
                                onTap: {}
                            )
                            .background(Color.spxElevated.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .accessibilityIdentifier("queue-now-playing")
                        }
                    }

                    // Up Next Section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Next Up")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color.spxTextTertiary)
                            .textCase(.uppercase)
                            .tracking(0.1)
                            .padding(.top, currentTrack != nil ? 8 : 0)

                        if queue.isEmpty {
                            emptyQueueView
                        } else {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(queue.enumerated()), id: \.element.id) { index, track in
                                    QueueItemView(
                                        track: track,
                                        index: index + 1,
                                        isCurrentlyPlaying: false,
                                        onTap: {
                                            playFromQueue(index: index + 1)
                                        }
                                    )
                                    .accessibilityIdentifier("queue-track-\(index)")
                                }
                            }
                        }
                    }
                }
                .padding(.bottom, 100)
            }
            .scrollIndicators(.hidden)
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
        .background(Color.spxBase)
        .accessibilityIdentifier("queue-view")
    }

    // MARK: - Empty Queue View
    private var emptyQueueView: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note.list")
                .font(.system(size: 32))
                .foregroundColor(Color.spxTextTertiary.opacity(0.5))

            Text("Queue is empty")
                .font(.system(size: 14))
                .foregroundColor(Color.spxTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Play From Queue
    private func playFromQueue(index: Int) {
        var uris: [String] = []
        if let currentUri = currentTrack?.uri {
            uris.append(currentUri)
        }
        uris.append(contentsOf: queue.map { $0.uri })

        let adjustedOffset = currentTrack != nil ? index : max(0, index - 1)
        onPlayUris(uris, adjustedOffset)
    }
}

// MARK: - Queue Item View
struct QueueItemView: View {
    let track: SpotifyTrack
    let index: Int
    let isCurrentlyPlaying: Bool
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 12) {
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

            // Track Info
            VStack(alignment: .leading, spacing: 2) {
                Text(track.name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(isCurrentlyPlaying ? Color.spxAccent : Color.spxTextPrimary)
                    .lineLimit(1)

                Text(track.artists?.compactMap { $0.name }.joined(separator: ", ") ?? "")
                    .font(.system(size: 12))
                    .foregroundColor(Color.spxTextTertiary)
                    .lineLimit(1)
            }

            Spacer()

            // Index / Duration
            if !isCurrentlyPlaying {
                Text("\(index)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(Color.spxTextTertiary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }
}
