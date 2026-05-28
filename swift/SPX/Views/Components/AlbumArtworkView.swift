import SwiftUI

struct AlbumArtworkView: View {
    enum Size {
        case small   // 56×56, cornerRadius 4
        case medium  // 80×80, cornerRadius 4
        case large   // 232×232, cornerRadius 8

        var dimension: CGFloat {
            switch self {
            case .small: return 56
            case .medium: return 80
            case .large: return 232
            }
        }

        var cornerRadius: CGFloat {
            switch self {
            case .small: return 4
            case .medium: return 4
            case .large: return 8
            }
        }

        var placeholderIconSize: CGFloat {
            switch self {
            case .small: return 14
            case .medium: return 20
            case .large: return 48
            }
        }
    }

    let urlString: String?
    let size: Size

    var body: some View {
        Group {
            if let urlString = urlString, let url = URL(string: urlString) {
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
        .frame(width: size.dimension, height: size.dimension)
        .clipShape(RoundedRectangle(cornerRadius: size.cornerRadius))
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: size.cornerRadius)
            .fill(Color.spxElevated)
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: size.placeholderIconSize))
                    .foregroundColor(Color.spxTextTertiary)
            )
    }
}
