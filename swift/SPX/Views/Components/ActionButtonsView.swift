import SwiftUI

struct ActionButtonsView: View {
    let isLiked: Bool
    let onToggleLike: () -> Void
    
    var body: some View {
        HStack(spacing: 20) {
            Button(action: onToggleLike) {
                Image(systemName: isLiked ? "heart.fill" : "heart")
            }
            .buttonStyle(ActionButtonStyle())
            .foregroundColor(isLiked ? Color.spxAccent : Color.spxTextSecondary)
            
            Button(action: {}) {
                Image(systemName: "square.and.arrow.up")
            }
            .buttonStyle(ActionButtonStyle())
            
            Button(action: {}) {
                Image(systemName: "link")
            }
            .buttonStyle(ActionButtonStyle())
        }
    }
}
