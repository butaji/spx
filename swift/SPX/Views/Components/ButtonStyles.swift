import SwiftUI

// MARK: - Icon Button (no background, just icon)
struct IconButtonStyle: ButtonStyle {
    let color: Color
    let hoverColor: Color
    let size: CGFloat
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: size))
            .foregroundColor(configuration.isPressed ? color.opacity(0.7) : color)
            .frame(width: size + 8, height: size + 8)
            .contentShape(Rectangle())
    }
}

// MARK: - Control Button (player controls)
struct ControlButtonStyle: ButtonStyle {
    let isActive: Bool
    let size: CGFloat
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: size))
            .foregroundColor(isActive ? Color.spxAccent : Color.spxTextSecondary)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .frame(width: max(size + 12, 32), height: max(size + 12, 32))
            .contentShape(Rectangle())
    }
}

// MARK: - Nav Button (sidebar items)
struct NavButtonStyle: ButtonStyle {
    let isActive: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(width: 80, height: 64)
            .background(isActive ? Color.spxOverlay : Color.clear)
            .foregroundColor(isActive ? Color.spxAccent : Color.spxTextSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

// MARK: - Action Button (heart, share, link - hero section)
struct ActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 20))
            .foregroundColor(Color.spxTextSecondary)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .frame(width: 40, height: 40)
            .contentShape(Rectangle())
    }
}
