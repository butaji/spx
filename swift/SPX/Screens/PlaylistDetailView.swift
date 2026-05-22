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
        .background(SPXColors.bg)
    }

    // MARK: - Playlist Hero View
    private var playlistHeroView: some View {
        HStack(alignment: .top, spacing: SPXSpacing.x6) {
            // Playlist Artwork
            if let imageUrl = playlist?.images?.first?.url, let url = URL(string: imageUrl) {
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
                        Image(systemName: "music.note.list")
                            .font(.system(size: 48))
                            .foregroundColor(SPXColors.fgMuted)
                    )
            }

            // Playlist Info
            VStack(alignment: .leading, spacing: SPXSpacing.x2) {
                Text("Playlist")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SPXColors.fgFaint)
                    .textCase(.uppercase)
                    .tracking(0.1)

                Text(playlist?.name ?? "Unknown Playlist")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(SPXColors.fg)
                    .lineLimit(2)

                if let description = playlist?.description, !description.isEmpty {
                    Text(description.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression))
                        .font(.system(size: 14))
                        .foregroundColor(SPXColors.fgSecondary)
                        .lineLimit(2)
                } else {
                    Text("\(tracks.count) tracks")
                        .font(.system(size: 14))
                        .foregroundColor(SPXColors.fgMuted)
                }

                if let owner = playlist?.owner {
                    HStack(spacing: SPXSpacing.x1) {
                        Text("By")
                            .foregroundColor(SPXColors.fgMuted)
                        Text(owner.displayName ?? "Unknown")
                            .foregroundColor(SPXColors.fgSecondary)
                    }
                    .font(.system(size: 13))
                }

                // Action Buttons
                HStack(spacing: SPXSpacing.x3) {
                    Button(action: onPlayAll) {
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

                    Button(action: {}) {
                        Text("Follow +")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(SPXColors.fgSecondary)
                            .padding(.horizontal, SPXSpacing.x4)
                            .padding(.vertical, SPXSpacing.x2)
                            .overlay(
                                Capsule()
                                    .stroke(SPXColors.edgeLight, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
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

    // MARK: - Empty View
    private var emptyView: some View {
        VStack(spacing: SPXSpacing.x3) {
            Image(systemName: "music.note")
                .font(.system(size: 32))
                .foregroundColor(SPXColors.fgMuted.opacity(0.5))

            Text("No tracks in this playlist")
                .font(.system(size: 14))
                .foregroundColor(SPXColors.fgSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, SPXSpacing.x8)
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
        .padding(.horizontal, SPXSpacing.x6)
    }
}

// MARK: - Playlist Track Row
struct PlaylistTrackRow: View {
    let track: SpotifyTrack
    let index: Int
    let onTap: () -> Void

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: SPXSpacing.x3) {
            Text("\(index + 1)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(SPXColors.fgFaint)
                .frame(width: 32, alignment: .center)

            // Artwork
            if let imageUrl = track.album?.images?.first?.url, let url = URL(string: imageUrl) {
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
