import SwiftUI

// MARK: - Theme Colors

struct ThemeColors {
    let background: Color
    let elevated: Color
    let overlay: Color
    let surface: Color
    let primaryText: Color
    let secondaryText: Color
    let tertiaryText: Color
    let accent: Color
    let accentHover: Color
    let border: Color
    let divider: Color
}

// MARK: - Theme Presets
// Note: Colors are sourced from Color extension in Colors.swift for consistency

extension ThemeColors {
    static let dark = ThemeColors(
        background: .spxBase,
        elevated: .spxElevated,
        overlay: .spxOverlay,
        surface: Color(hex: "242424"),
        primaryText: .white,
        secondaryText: .spxTextSecondary,
        tertiaryText: .spxTextTertiary,
        accent: .spxAccent,
        accentHover: Color(hex: "1ED760"),
        border: .spxBorder,
        divider: Color(hex: "333333")
    )

    static let light = ThemeColors(
        background: Color(hex: "F5F5F7"),
        elevated: .white,
        overlay: Color(hex: "E8E8ED"),
        surface: Color(hex: "DEDEE3"),
        primaryText: Color(hex: "1D1D1F"),
        secondaryText: Color(hex: "6E6E73"),
        tertiaryText: Color(hex: "86868B"),
        accent: .spxAccent,
        accentHover: Color(hex: "1ED760"),
        border: Color(hex: "D2D2D7"),
        divider: Color(hex: "E5E5EA")
    )
}

// MARK: - Environment Key

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = ThemeColors.dark
}

extension EnvironmentValues {
    var theme: ThemeColors {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

// MARK: - Animation Presets

enum ThemeAnimation {
    static let spring = Animation.spring(response: 0.35, dampingFraction: 0.8)
    static let smooth = Animation.easeInOut(duration: 0.2)
    static let hover = Animation.easeOut(duration: 0.15)
}

// MARK: - Corner Radius Presets

enum ThemeRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 16
    static let xl: CGFloat = 20
    static let full: CGFloat = 9999
}

// MARK: - Shadow Presets

enum ThemeShadow {
    static let card = ShadowStyle(
        color: .black.opacity(0.15),
        radius: 20,
        x: 0,
        y: 8
    )
    static let elevated = ShadowStyle(
        color: .black.opacity(0.25),
        radius: 32,
        x: 0,
        y: 16
    )
}

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

// MARK: - Spacing Presets

enum ThemeSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}
