import SwiftUI

struct PlayerBarView: View {
    var trackName: String = ""
    var artistName: String = ""
    var artworkUrl: String?
    var isPlaying: Bool = false
    var isLiked: Bool = false
    var shuffleActive: Bool = false
    var repeatMode: String = "off"
    var progress: Double = 0
    var currentTimeMs: Int = 0
    var durationMs: Int = 0
    var volume: Double = 0.5

    var onPlayPause: (() -> Void)?
    var onNext: (() -> Void)?
    var onPrev: (() -> Void)?
    var onSeek: ((Double) -> Void)?
    var onVolumeChange: ((Double) -> Void)?
    var onToggleShuffle: (() -> Void)?
    var onToggleRepeat: (() -> Void)?
    var onToggleLike: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            // Controls row
            HStack(spacing: 16) {
                // Left: Track info
                HStack(spacing: 10) {
                    if let urlString = artworkUrl, !urlString.isEmpty {
                        AsyncImage(url: URL(string: urlString)) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().aspectRatio(contentMode: .fill)
                            case .failure, .empty:
                                placeholderArtwork
                            @unknown default:
                                placeholderArtwork
                            }
                        }
                        .frame(width: 42, height: 42)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    } else {
                        placeholderArtwork
                            .frame(width: 42, height: 42)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(trackName.isEmpty ? "Not Playing" : trackName)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color(hex: "#f5f5f5"))
                            .lineLimit(1)
                            .frame(maxWidth: 160, alignment: .leading)

                        Text(artistName.isEmpty ? "Unknown Artist" : artistName)
                            .font(.system(size: 11, weight: .regular))
                            .foregroundColor(Color(hex: "#a0a0a0"))
                            .lineLimit(1)
                    }

                    Button(action: { onToggleLike?() }) {
                        Image(systemName: isLiked ? "heart.fill" : "heart")
                            .font(.system(size: 15))
                            .foregroundColor(isLiked ? Color(hex: "#1DB954") : Color(hex: "#a0a0a0"))
                    }
                    .buttonStyle(.plain)
                }
                .frame(width: 220, alignment: .leading)

                // Center: Controls
                HStack(spacing: 12) {
                    Button(action: { onToggleShuffle?() }) {
                        Image(systemName: "shuffle")
                            .font(.system(size: 16))
                            .foregroundColor(shuffleActive ? Color(hex: "#1DB954") : Color(hex: "#f5f5f5"))
                    }
                    .buttonStyle(.plain)

                    Button(action: { onPrev?() }) {
                        Image(systemName: "backward.fill")
                            .font(.system(size: 16))
                            .foregroundColor(Color(hex: "#f5f5f5"))
                    }
                    .buttonStyle(.plain)

                    Button(action: { onPlayPause?() }) {
                        Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 22))
                            .foregroundColor(Color(hex: "#f5f5f5"))
                            .frame(width: 32, height: 32)
                            .background(Color(hex: "#f5f5f5").opacity(0.15))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)

                    Button(action: { onNext?() }) {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 16))
                            .foregroundColor(Color(hex: "#f5f5f5"))
                    }
                    .buttonStyle(.plain)

                    Button(action: { onToggleRepeat?() }) {
                        Image(systemName: repeatMode == "one" ? "repeat.1" : "repeat")
                            .font(.system(size: 16))
                            .foregroundColor(repeatMode != "off" ? Color(hex: "#1DB954") : Color(hex: "#f5f5f5"))
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)

                // Right: Volume
                HStack(spacing: 8) {
                    Image(systemName: "laptopcomputer")
                        .font(.system(size: 14))
                        .foregroundColor(Color(hex: "#a0a0a0"))

                    Image(systemName: volumeIcon)
                        .font(.system(size: 16))
                        .foregroundColor(Color(hex: "#a0a0a0"))

                    Slider(value: Binding(get: { volume }, set: { onVolumeChange?($0) }), in: 0...1)
                        .tint(Color(hex: "#f5f5f5"))
                        .frame(width: 80)
                }
                .frame(width: 200, alignment: .trailing)
            }
            .padding(.horizontal, 18)
            .frame(height: 52)

            // Progress bar spanning below everything
            HStack(spacing: 8) {
                Text(formatTime(currentTimeMs))
                    .font(.system(size: 10, design: .monospaced).monospacedDigit())
                    .foregroundColor(Color(hex: "#a0a0a0"))
                    .frame(width: 36, alignment: .trailing)

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color(hex: "#333333"))
                            .frame(height: 3)

                        Rectangle()
                            .fill(Color(hex: "#f5f5f5"))
                            .frame(width: geometry.size.width * progress, height: 3)
                    }
                    .cornerRadius(1.5)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let newProgress = min(max(value.location.x / geometry.size.width, 0), 1)
                                onSeek?(newProgress)
                            }
                    )
                }
                .frame(height: 3)

                Text(formatTime(durationMs))
                    .font(.system(size: 10, design: .monospaced).monospacedDigit())
                    .foregroundColor(Color(hex: "#a0a0a0"))
                    .frame(width: 36, alignment: .leading)
            }
            .padding(.horizontal, 18)
            .frame(height: 16)
        }
        .frame(height: 68)
        .background(Color(hex: "#111111"))
    }

    private var placeholderArtwork: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color(hex: "#1a1a1a"))
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: 16))
                    .foregroundColor(Color(hex: "#666666"))
            )
    }

    private var volumeIcon: String {
        if volume == 0 { return "speaker.slash.fill" }
        if volume < 0.33 { return "speaker.fill" }
        if volume < 0.66 { return "speaker.wave.1.fill" }
        return "speaker.wave.2.fill"
    }

    private func formatTime(_ ms: Int) -> String {
        let totalSeconds = ms / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
