import SwiftUI

enum ProgressBarStyle {
    case hero    // 4px, fill fgSecondary, track border (rgba white 10%)
    case player  // 4px, fill accent, track border (rgba white 10%)
}

struct ProgressBarView: View {
    let progress: Double  // 0.0 to 1.0
    let style: ProgressBarStyle
    let onSeek: ((Double) -> Void)?

    private var height: CGFloat {
        4
    }

    private var fillColor: Color {
        switch style {
        case .hero: return Color.spxTextSecondary
        case .player: return Color.spxAccent
        }
    }

    private var trackColor: Color {
        Color.spxBorder
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Track (pill shape)
                Capsule()
                    .fill(trackColor)
                    .frame(height: height)

                // Fill (pill shape)
                Capsule()
                    .fill(fillColor)
                    .frame(width: geometry.size.width * progress, height: height)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let newProgress = min(max(value.location.x / geometry.size.width, 0), 1)
                        onSeek?(newProgress)
                    }
            )
        }
        .frame(height: height)
    }
}
