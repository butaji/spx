import SwiftUI

struct PlayerBarView: View {
    let trackName: String
    let artistName: String
    let artworkUrl: String?
    let isPlaying: Bool
    let isLiked: Bool
    let shuffleActive: Bool
    let repeatMode: String
    let progress: Double
    let currentTimeMs: Int
    let durationMs: Int
    let volume: Double

    let onPlayPause: () -> Void
    let onNext: () -> Void
    let onPrev: () -> Void
    let onSeek: (Double) -> Void
    let onVolumeChange: (Double) -> Void
    let onToggleShuffle: () -> Void
    let onToggleRepeat: () -> Void
    let onToggleLike: () -> Void

    @State private var isHoveringShuffle = false
    @State private var isHoveringPrev = false
    @State private var isHoveringNext = false
    @State private var isHoveringRepeat = false
    @State private var isHoveringPlayPause = false
    @State private var isHoveringProgress = false
    @State private var isHoveringLike = false
    @State private var isHoveringVolume = false

    var body: some View {
        HStack(spacing: 0) {
            // LEFT ZONE
            HStack(spacing: 12) {
                // Mini album art
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: "181818"))
                    .frame(width: 56, height: 56)
                    .overlay(
                        Image(systemName: "music.note")
                            .font(.system(size: 20))
                            .foregroundColor(Color(hex: "6A6A6A"))
                    )
                    .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                    )

                // Track info
                VStack(alignment: .leading, spacing: 2) {
                    Text(trackName)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                    Text(artistName)
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "A7A7A7"))
                }

                // Heart
                Button(action: onToggleLike) {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .font(.system(size: 16, weight: .regular))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(isLiked ? .red : Color(hex: "A7A7A7"))
                }
                .buttonStyle(.plain)
                .scaleEffect(isHoveringLike ? 1.2 : 1.0)
                .brightness(isHoveringLike ? 0.2 : 0)
                .onHover { isHoveringLike = $0 }
                .animation(.easeOut(duration: 0.15), value: isHoveringLike)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // CENTER ZONE
            VStack(spacing: 4) {
                HStack(spacing: 24) {
                    // Shuffle
                    Button(action: onToggleShuffle) {
                        Image(systemName: "shuffle")
                            .font(.system(size: 16))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundColor(shuffleActive ? .spxAccent : .spxTextSecondary)
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(isHoveringShuffle ? 1.2 : 1.0)
                    .brightness(isHoveringShuffle ? 0.3 : 0)
                    .onHover { isHoveringShuffle = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringShuffle)

                    // Previous
                    Button(action: onPrev) {
                        Image(systemName: "backward.end.fill")
                            .font(.system(size: 20))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundColor(.spxTextSecondary)
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(isHoveringPrev ? 1.2 : 1.0)
                    .brightness(isHoveringPrev ? 0.3 : 0)
                    .onHover { isHoveringPrev = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringPrev)

                    // Play/Pause
                    Button(action: onPlayPause) {
                        Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 28))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundColor(.spxTextPrimary)
                            .contentTransition(.symbolEffect(.automatic))
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(isHoveringPlayPause ? 1.15 : 1.0)
                    .brightness(isHoveringPlayPause ? 0.2 : 0)
                    .onHover { isHoveringPlayPause = $0 }
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHoveringPlayPause)

                    // Next
                    Button(action: onNext) {
                        Image(systemName: "forward.end.fill")
                            .font(.system(size: 20))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundColor(.spxTextSecondary)
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(isHoveringNext ? 1.2 : 1.0)
                    .brightness(isHoveringNext ? 0.3 : 0)
                    .onHover { isHoveringNext = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringNext)

                    // Repeat
                    Button(action: onToggleRepeat) {
                        Image(systemName: repeatMode == "track" ? "repeat.1" : "repeat")
                            .font(.system(size: 16))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundColor(repeatMode != "off" ? .spxAccent : .spxTextSecondary)
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(isHoveringRepeat ? 1.2 : 1.0)
                    .brightness(isHoveringRepeat ? 0.3 : 0)
                    .onHover { isHoveringRepeat = $0 }
                    .animation(.easeOut(duration: 0.15), value: isHoveringRepeat)
                }

                HStack(spacing: 8) {
                    Text(formatTime(currentTimeMs))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.spxTextTertiary)

                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.separator.opacity(0.5)).frame(height: 4)
                            Capsule().fill(.white).frame(
                                width: g.size.width * progress,
                                height: 4
                            )
                            Circle()
                                .fill(.white)
                                .shadow(color: .black.opacity(0.3), radius: 4)
                                .frame(width: isHoveringProgress ? 12 : 0, height: isHoveringProgress ? 12 : 0)
                                .position(
                                    x: g.size.width * progress,
                                    y: 2
                                )
                        }
                        .contentShape(Rectangle())
                        .onHover { isHoveringProgress = $0 }
                        .animation(.easeOut(duration: 0.2), value: isHoveringProgress)
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { value in
                                    let newProgress = min(max(0, value.location.x / g.size.width), 1)
                                    onSeek(newProgress)
                                }
                        )
                    }
                    .frame(height: 12)

                    Text(formatTime(durationMs))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.spxTextTertiary)
                }
            }
            .frame(maxWidth: .infinity)

            // RIGHT ZONE
            HStack(spacing: 16) {
                Button(action: {}) {
                    Image(systemName: "square.grid.2x2")
                        .font(.system(size: 16))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(.spxTextSecondary)
                }
                .buttonStyle(.plain)

                Button(action: {}) {
                    Image(systemName: "speaker.wave.2")
                        .font(.system(size: 16))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(.spxTextSecondary)
                }
                .buttonStyle(.plain)

                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.separator.opacity(0.5)).frame(height: 4)
                        Capsule().fill(.white).frame(
                            width: g.size.width * volume,
                            height: 4
                        )
                        Circle()
                            .fill(.white)
                            .shadow(color: .black.opacity(0.3), radius: 4)
                            .frame(width: isHoveringVolume ? 12 : 0, height: isHoveringVolume ? 12 : 0)
                            .position(
                                x: g.size.width * volume,
                                y: 2
                            )
                    }
                    .contentShape(Rectangle())
                    .onHover { isHoveringVolume = $0 }
                    .animation(.easeOut(duration: 0.2), value: isHoveringVolume)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let newVolume = min(max(0, value.location.x / g.size.width), 1)
                                onVolumeChange(newVolume)
                            }
                    )
                }
                .frame(width: 100, height: 12)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .frame(height: 80)
        .padding(.horizontal, 16)
        .background(.thinMaterial)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundStyle(.separator),
            alignment: .top
        )
    }

    private func formatTime(_ millis: Int) -> String {
        let totalSeconds = millis / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
