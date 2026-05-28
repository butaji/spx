import SwiftUI

struct PlayerTrackInfoView: View {
    let trackName: String
    let artistName: String
    let artworkUrl: String?
    let isLiked: Bool
    let onToggleLike: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            AlbumArtworkView(urlString: artworkUrl, size: .small)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(trackName.isEmpty ? "Not Playing" : trackName)
                    .font(.system(size: 14))
                    .foregroundColor(Color.spxTextPrimary)
                    .lineLimit(1)
                
                Text(artistName.isEmpty ? "Unknown Artist" : artistName)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.spxTextSecondary)
                    .lineLimit(1)
            }
            
            Button(action: onToggleLike) {
                Image(systemName: isLiked ? "heart.fill" : "heart")
            }
            .buttonStyle(IconButtonStyle(
                color: isLiked ? Color.spxAccent : Color.spxTextSecondary,
                hoverColor: Color.spxTextPrimary,
                size: 16
            ))
        }
    }
}
