import SwiftUI

extension Color {
    static let spxBase = Color(hex: "0A0A0A")         // Main bg
    static let spxElevated = Color(hex: "121212")      // Player bar, cards
    static let spxOverlay = Color(hex: "181818")       // Hover, stats pill, empty art
    static let spxActiveGreen = Color(hex: "1A3A1A")  // Sidebar active bg ONLY
    static let spxAccent = Color(hex: "1DB954")        // Green text/icons
    static let spxTextPrimary = Color.white
    static let spxTextSecondary = Color(hex: "A7A7A7")
    static let spxTextTertiary = Color(hex: "6A6A6A")
    static let spxBorder = Color(hex: "2A2A2A")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let red, green, blue: Double
        red = Double((int >> 16) & 0xFF) / 255
        green = Double((int >> 8) & 0xFF) / 255
        blue = Double(int & 0xFF) / 255
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: 1)
    }
}
