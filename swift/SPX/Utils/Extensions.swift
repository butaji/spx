import SwiftUI

// MARK: - Time Formatting

extension String {
    static func formatDuration(millis: Int) -> String {
        let totalSeconds = millis / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    static func formatDurationLong(millis: Int) -> String {
        let totalSeconds = millis / 1000
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - View Modifiers

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.spxElevated)
            .cornerRadius(8)
    }
}

struct HoverStyle: ViewModifier {
    @State private var isHovered = false

    func body(content: Content) -> some View {
        content
            .background(isHovered ? Color.spxOverlay : Color.clear)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

struct EdgeModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .overlay(
                Rectangle()
                    .fill(Color.spxBorder)
            )
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardStyle())
    }

    func hoverStyle() -> some View {
        modifier(HoverStyle())
    }

    func spxEdge() -> some View {
        modifier(EdgeModifier())
    }
}
