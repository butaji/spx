import SwiftUI

struct PlaylistCardView: View {
    let name: String
    let imageUrl: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Image
            Group {
                if let urlString = imageUrl, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure, .empty:
                            placeholder
                        @unknown default:
                            placeholder
                        }
                    }
                } else {
                    placeholder
                }
            }
            .frame(width: 160, height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Name
                Text(name)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(Color.spxTextPrimary)
                    .lineLimit(1)
        }
        .frame(width: 160)
        .accessibilityLabel(name)
        .accessibilityHint("Double tap to open playlist")
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.spxElevated)
    }
}
