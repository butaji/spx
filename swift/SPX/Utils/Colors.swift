import SwiftUI

// swiftlint:disable identifier_name

// MARK: - Time Formatting

func formatTime(_ millis: Int) -> String {
    let seconds = millis / 1000
    return String(format: "%d:%02d", seconds / 60, seconds % 60)
}

// MARK: - Design Tokens
enum SPXColors {
    static let bg = Color(hex: "0a0a0a")
    static let bgElevated = Color(hex: "111111")
    static let bgHover = Color(hex: "1a1a1a")
    static let surface = Color(hex: "1a1a1a")
    static let surfaceHover = Color(hex: "1a1a1a")
    static let fg = Color(hex: "f5f5f5")
    static let fgSecondary = Color(hex: "a0a0a0")
    static let fgMuted = Color(hex: "666666")
    static let fgFaint = Color(hex: "555555")
    static let accent = Color(hex: "1DB954")
    static let accentSubtle = Color(hex: "1DB954").opacity(0.1)
    static let accentDim = Color(hex: "1DB954").opacity(0.2)
    static let danger = Color(hex: "ff4444")
    static let edge = Color.white.opacity(0.06)
    static let edgeLight = Color.white.opacity(0.1)
}

enum SPXSpacing {
    static let x1: CGFloat = 4
    static let x2: CGFloat = 8
    static let x3: CGFloat = 12
    static let x4: CGFloat = 16
    static let x5: CGFloat = 20
    static let x6: CGFloat = 24
    static let x7: CGFloat = 28
    static let x8: CGFloat = 32
    static let x10: CGFloat = 40
    static let x12: CGFloat = 48
}

enum SPXRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let full: CGFloat = 9999
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    static let spxBG = Color(hex: "0a0a0a")
    static let spxBGElevated = Color(hex: "111111")
    static let spxBGHover = Color(hex: "1a1a1a")
    static let spxSurface = Color(hex: "1a1a1a")
    static let spxFG = Color(hex: "f5f5f5")
    static let spxFGSecondary = Color(hex: "#a0a0a0")
    static let spxFGMuted = Color(hex: "#666666")
    static let spxFGFaint = Color(hex: "#555555")
    static let spxAccent = Color(hex: "#1DB954")
    static let spxDanger = Color(hex: "#ff4444")
    static let spxEdge = Color.white.opacity(0.06)
    static let spxEdgeLight = Color.white.opacity(0.1)
}
