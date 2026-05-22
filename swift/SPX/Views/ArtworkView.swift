import SwiftUI

// MARK: - ArtworkSize

enum ArtworkSize: CGFloat {
    case small = 32
    case medium = 40
    case large = 64
    case hero = 160
}

// MARK: - ArtworkShape

enum ArtworkShape {
    case square
    case round
}

// MARK: - ArtworkView

struct ArtworkView: View {
    let url: String?
    let size: ArtworkSize
    let shape: ArtworkShape

    @State private var isLoaded = false

    init(url: String?, size: ArtworkSize = .medium, shape: ArtworkShape = .square) {
        self.url = url
        self.size = size
        self.shape = shape
    }

    private var cornerRadius: CGFloat {
        switch shape {
        case .square:
            return 6
        case .round:
            return size.rawValue / 2
        }
    }

    private var musicNoteIcon: some View {
        Image(systemName: "music.note")
            .resizable()
            .scaledToFit()
            .frame(width: size.rawValue * 0.5, height: size.rawValue * 0.5)
            .foregroundColor(SPXColors.fgMuted)
    }

    var body: some View {
        Group {
            if let urlString = url, let imageUrl = URL(string: urlString) {
                AsyncImage(url: imageUrl) { phase in
                    switch phase {
                    case .empty:
                        musicNoteIcon
                            .transition(.opacity)
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                            .opacity(isLoaded ? 1 : 0)
                            .onAppear {
                                withAnimation(.easeIn(duration: 0.3)) {
                                    isLoaded = true
                                }
                            }
                    case .failure:
                        musicNoteIcon
                    @unknown default:
                        musicNoteIcon
                    }
                }
            } else {
                musicNoteIcon
            }
        }
        .frame(width: size.rawValue, height: size.rawValue)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .background(
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(SPXColors.surface)
        )
    }
}

#Preview {
    VStack(spacing: 20) {
        HStack(spacing: 10) {
            ArtworkView(url: nil, size: .small, shape: .square)
            ArtworkView(url: nil, size: .medium, shape: .square)
            ArtworkView(url: nil, size: .large, shape: .square)
            ArtworkView(url: nil, size: .hero, shape: .square)
        }

        HStack(spacing: 10) {
            ArtworkView(url: nil, size: .small, shape: .round)
            ArtworkView(url: nil, size: .medium, shape: .round)
            ArtworkView(url: nil, size: .large, shape: .round)
        }
    }
    .padding()
    .background(SPXColors.bg)
}
