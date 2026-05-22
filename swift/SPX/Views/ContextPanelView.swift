import SwiftUI

struct ContextPanelView: View {
    @EnvironmentObject private var appState: AppState

    private var artist: SpotifyArtist? {
        appState.contextPanelItem
    }

    private var formattedFollowers: String {
        guard let followers = artist?.followers?.total else { return "" }
        if followers >= 1_000_000 {
            return String(format: "%.1fM followers", Double(followers) / 1_000_000)
        } else if followers >= 1_000 {
            return String(format: "%.1fK followers", Double(followers) / 1_000)
        }
        return "\(followers) followers"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Artist")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(SPXColors.fgFaint)
                    .textCase(.uppercase)
                    .tracking(0.5)

                Spacer()

                Button {
                    appState.contextPanelItem = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(SPXColors.fgMuted)
                        .frame(width: 24, height: 24)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(SPXColors.bgElevated)

            Divider()
                .background(SPXColors.edge)

            // Content
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let artist = artist {
                        artistContent(artist)
                    } else {
                        Text("No artist selected")
                            .font(.system(size: 13))
                            .foregroundColor(SPXColors.fgMuted)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 40)
                    }
                }
                .padding(16)
            }
        }
        .frame(width: 280)
        .background(SPXColors.bgElevated)
        .overlay(
            Rectangle()
                .fill(SPXColors.edge)
                .frame(width: 1),
            alignment: .leading
        )
    }

    @ViewBuilder
    private func artistContent(_ artist: SpotifyArtist) -> some View {
        artistImage(artist)
        artistInfo(artist)
        artistGenres(artist)
    }

    @ViewBuilder
    private func artistImage(_ artist: SpotifyArtist) -> some View {
        if let imageUrl = artist.images?.first?.url, let url = URL(string: imageUrl) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                RoundedRectangle(cornerRadius: 8)
                    .fill(SPXColors.surface)
            }
            .frame(width: 248, height: 248)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(SPXColors.surface)
                .frame(width: 248, height: 248)
        }
    }

    private func artistInfo(_ artist: SpotifyArtist) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(artist.name)
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(SPXColors.fg)
                .lineLimit(2)

            Text(formattedFollowers)
                .font(.system(size: 13))
                .foregroundColor(SPXColors.fgSecondary)
        }
    }

    @ViewBuilder
    private func artistGenres(_ artist: SpotifyArtist) -> some View {
        if let genres = artist.genres, !genres.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Genres")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SPXColors.fgFaint)
                    .textCase(.uppercase)
                    .tracking(0.5)

                FlowLayout(spacing: 6) {
                    ForEach(genres.prefix(5), id: \.self) { genre in
                        Text(genre)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(SPXColors.fg)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(SPXColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)

        for (index, subview) in subviews.enumerated() {
            let point = result.positions[index]
            subview.place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            positions.append(CGPoint(x: currentX, y: currentY))
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalWidth = max(totalWidth, currentX - spacing)
            totalHeight = currentY + lineHeight
        }

        return (CGSize(width: totalWidth, height: totalHeight), positions)
    }
}

#Preview {
    HStack(spacing: 0) {
        Color.spxBG
        ContextPanelView()
    }
    .frame(width: 600, height: 500)
}
