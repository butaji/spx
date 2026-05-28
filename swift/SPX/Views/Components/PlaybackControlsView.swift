import SwiftUI

struct PlaybackControlsView: View {
    let isPlaying: Bool
    let shuffleActive: Bool
    let repeatMode: String
    let onPlayPause: () -> Void
    let onPrev: () -> Void
    let onNext: () -> Void
    let onToggleShuffle: () -> Void
    let onToggleRepeat: () -> Void
    
    var body: some View {
        HStack(spacing: 16) {
            Button(action: onToggleShuffle) {
                Image(systemName: "shuffle")
            }
            .buttonStyle(ControlButtonStyle(isActive: shuffleActive, size: 14))
            
            Button(action: onPrev) {
                Image(systemName: "backward.fill")
            }
            .buttonStyle(ControlButtonStyle(isActive: false, size: 20))
            
            Button(action: onPlayPause) {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
            }
            .buttonStyle(ControlButtonStyle(isActive: false, size: 20))
            .frame(width: 40)
            
            Button(action: onNext) {
                Image(systemName: "forward.fill")
            }
            .buttonStyle(ControlButtonStyle(isActive: false, size: 20))
            
            Button(action: onToggleRepeat) {
                Image(systemName: repeatMode == "one" ? "repeat.1" : "repeat")
            }
            .buttonStyle(ControlButtonStyle(isActive: repeatMode != "off", size: 14))
        }
    }
}
