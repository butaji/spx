import SwiftUI

// MARK: - Playback Controls

struct PlaybackControls: View {
    let isPlaying: Bool
    let shuffleActive: Bool
    let repeatMode: String
    let onShuffle: () -> Void
    let onPrev: () -> Void
    let onPlayPause: () -> Void
    let onNext: () -> Void
    let onRepeat: () -> Void
    
    var body: some View {
        HStack(spacing: 20) {
            ControlButton(icon: "shuffle", size: 16, isActive: shuffleActive, action: onShuffle)
            ControlButton(icon: "backward.fill", size: 18, action: onPrev)
            PlayButton(isPlaying: isPlaying, action: onPlayPause)
            ControlButton(icon: "forward.fill", size: 18, action: onNext)
            ControlButton(
                icon: repeatMode == "one" ? "repeat.1" : "repeat",
                size: 16,
                isActive: repeatMode != "off",
                action: onRepeat
            )
        }
    }
}

// MARK: - Play Button

struct PlayButton: View {
    let isPlaying: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 28))
                .foregroundColor(.white)
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.15))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Control Button

struct ControlButton: View {
    let icon: String
    let size: CGFloat
    var isActive: Bool = false
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size))
                .foregroundColor(isActive ? Color(hex: "#1DB954") : .gray)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Track Info

struct TrackInfoView: View {
    let name: String
    let artist: String
    let artworkUrl: String?
    let isLiked: Bool
    let onToggleLike: () -> Void
    
    var body: some View {
        HStack(spacing: 10) {
            ArtworkView(url: artworkUrl, size: .medium)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(name.isEmpty ? "Not Playing" : name)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                Text(artist.isEmpty ? "Unknown Artist" : artist)
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
                    .lineLimit(1)
            }
            
            ControlButton(icon: isLiked ? "heart.fill" : "heart", size: 16, isActive: isLiked, action: onToggleLike)
        }
    }
}

// MARK: - Volume Control

struct VolumeControl: View {
    let volume: Double
    let onVolumeChange: (Double) -> Void
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "laptopcomputer")
                .font(.system(size: 14))
                .foregroundColor(.gray)
            
            Image(systemName: volumeIcon)
                .font(.system(size: 16))
                .foregroundColor(.gray)
            
            Slider(value: Binding(get: { volume }, set: onVolumeChange))
                .tint(.white)
                .frame(width: 80)
        }
    }
    
    private var volumeIcon: String {
        if volume == 0 { return "speaker.slash.fill" }
        if volume < 0.33 { return "speaker.fill" }
        if volume < 0.66 { return "speaker.wave.1.fill" }
        return "speaker.wave.2.fill"
    }
}

// MARK: - Progress Bar

struct ProgressBar: View {
    let progress: Double
    let currentTimeMs: Int
    let durationMs: Int
    let onSeek: (Double) -> Void

    var body: some View {
        HStack(spacing: 8) {
            Text(formatTime(currentTimeMs))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.gray)
                .frame(width: 40, alignment: .trailing)

            Slider(value: Binding(get: { progress }, set: onSeek))
                .tint(.white)

            Text(formatTime(durationMs))
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.gray)
                .frame(width: 40, alignment: .leading)
        }
    }

    private func formatTime(_ millis: Int) -> String {
        let seconds = millis / 1000
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

// MARK: - Action Buttons

struct ActionButtons: View {
    let isLiked: Bool
    let onToggleLike: () -> Void
    
    var body: some View {
        HStack(spacing: 20) {
            ControlButton(icon: isLiked ? "heart.fill" : "heart", size: 22, isActive: isLiked, action: onToggleLike)
            ControlButton(icon: "square.and.arrow.up", size: 22, action: {})
            ControlButton(icon: "link", size: 22, action: {})
        }
    }
}

// MARK: - Sidebar Button

struct SidebarButton: View {
    let item: SidebarItem
    let isActive: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: item.icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(isActive ? Color(hex: "#1DB954") : .gray)
                
                Text(item.rawValue)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isActive ? Color(hex: "#1DB954") : .gray)
            }
            .frame(width: 94, height: 56)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isActive ? Color(hex: "#1DB954").opacity(0.15) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Artwork

struct HeroArtwork: View {
    let url: String?
    let size: CGFloat
    
    var body: some View {
        if let urlString = url, let url = URL(string: urlString) {
            AsyncImage(url: url) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                placeholder
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        } else {
            placeholder
                .frame(width: size, height: size)
        }
    }
    
    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(hex: "#1a1a1a"))
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: 64))
                    .foregroundColor(Color(hex: "#666666"))
            )
    }
}

// MARK: - Time Label

struct TimeLabel: View {
    let ms: Int
    var alignment: Alignment = .leading

    var body: some View {
        Text(formatTime(ms))
            .font(.system(size: 11, design: .monospaced))
            .foregroundColor(Color(hex: "#888888"))
            .frame(width: 40, alignment: alignment)
    }

    private func formatTime(_ millis: Int) -> String {
        let seconds = millis / 1000
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
