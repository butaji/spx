import SwiftUI

// MARK: - Playlist Detail View
struct PlaylistDetailView: View {
    let playlist: SpotifyPlaylist?
    let tracks: [SpotifyTrack]
    let isLoading: Bool
    let onPlayAll: () -> Void
    let onPlayTrack: (Int) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero Section
                playlistHeroView

                // Track List
                if isLoading {
                    loadingView
                } else if tracks.isEmpty {
                    emptyView
                } else {
                    trackListView
                }
            }
            .padding(.bottom, 100)
        }
        .background(Color.spxBase)
    }

    // MARK: - Playlist Hero View
    private var playlistHeroView: some View {
        HStack(alignment: .top, spacing: 24) {
            // Playlist Artwork
            if let imageUrl = playlist?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url, content: { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                },
                placeholder: {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.spxElevated)
                        .overlay(
                            ProgressView()
                                .tint(Color.spxTextTertiary)
                        )
                })
                .frame(width: 280, height: 280)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
            } else {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.spxElevated)
                    .frame(width: 280, height: 280)
                    .overlay(
                        Image(systemName: "music.note.list")
                            .font(.system(size: 48))
                            .foregroundColor(Color.spxTextTertiary)
                    )
            }

            // Playlist Info
            VStack(alignment: .leading, spacing: 8) {
                Text("Playlist")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color.spxTextTertiary)
                    .textCase(.uppercase)
                    .tracking(0.1)

                Text(playlist?.name ?? "Unknown Playlist")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(Color.spxTextPrimary)
                    .lineLimit(2)

                if let description = playlist?.description, !description.isEmpty {
                    Text(description.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression))
                        .font(.system(size: 14))
                        .foregroundColor(Color.spxTextSecondary)
                        .lineLimit(2)
                } else {
                    Text("\(tracks.count) tracks")
                        .font(.system(size: 14))
                        .foregroundColor(Color.spxTextTertiary)
                }

                if let owner = playlist?.owner {
                    HStack(spacing: 4) {
                        Text("By")
                            .foregroundColor(Color.spxTextTertiary)
                        Text(owner.displayName ?? "Unknown")
                            .foregroundColor(Color.spxTextSecondary)
                    }
                    .font(.system(size: 13))
                }

                // Action Buttons
                HStack(spacing: 12) {
                    Button(action: onPlayAll) {
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
                    .accessibilityLabel("Play all tracks")
                    .accessibilityIdentifier("play-playlist-button")

                    Button(action: {}) {
                        Text("Follow +")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.spxTextSecondary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .overlay(
                                Capsule()
                                    .stroke(Color.spxBorder, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Follow playlist")
                    .accessibilityIdentifier("follow-playlist-button")
                }
                .padding(.top, 16)
            }
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

    // MARK: - Empty View
    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note")
                .font(.system(size: 32))
                .foregroundColor(Color.spxTextTertiary.opacity(0.5))

            Text("No tracks in this playlist")
                .font(.system(size: 14))
                .foregroundColor(Color.spxTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Track List View
    private var trackListView: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                PlaylistTrackRow(
                    track: track,
                    index: index,
                    onTap: {
                        onPlayTrack(index)
                    }
                )
            }
        }
        .padding(.horizontal, 24)
    }
}

// MARK: - Playlist Track Row
struct PlaylistTrackRow: View {
    let track: SpotifyTrack
    let index: Int
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 12) {
            Text("\(index + 1)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.spxTextTertiary)
                .frame(width: 32, alignment: .center)

            // Artwork
            if let imageUrl = track.album?.images?.first?.url, let url = URL(string: imageUrl) {
                AsyncImage(url: url, content: { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                }, placeholder: {
                    RoundedRectangle(cornerRadius: 4).fill(Color.spxElevated)
                })
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

                Text(track.artists?.map { $0.name }.compactMap { $0 }.joined(separator: ", ") ?? "")
                    .font(.system(size: 12))
                    .foregroundColor(Color.spxTextTertiary)
                    .lineLimit(1)
            }

            Spacer()

            Text(String.formatDuration(millis: track.durationMs ?? 0))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(Color.spxTextTertiary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(isHovered ? Color.spxOverlay : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(track.name) by \(track.artists?.map { $0.name }.compactMap { $0 }.joined(separator: ", ") ?? "")"
        )
        .accessibilityHint("Double tap to play")
        .accessibilityIdentifier("playlist-track-row-\(index)")
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onTap()
        }
    }
}
