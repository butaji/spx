import SwiftUI

struct SidebarView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.colorScheme) private var colorScheme
    
    private let sidebarItems: [(String, String)] = [
        ("square.grid.2x2", "Now Playing"),
        ("magnifyingglass", "Search"),
        ("music.note", "Library"),
        ("plus", "Queue")
    ]
    
    private var activeItem: String {
        switch appState.currentView {
        case .home: return "Now Playing"
        case .search: return "Search"
        case .library: return "Library"
        case .queue: return "Queue"
        default: return "Now Playing"
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Align first item with album art top
            Spacer()
                .frame(height: 24)
            
            ForEach(sidebarItems, id: \.1) { icon, label in
                SidebarItem(
                    icon: icon,
                    label: label,
                    isActive: activeItem == label
                ) {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        switch label {
                        case "Now Playing": appState.currentView = .home
                        case "Search": appState.currentView = .search
                        case "Library": appState.currentView = .library(tab: nil)
                        case "Queue": appState.currentView = .queue
                        default: break
                        }
                    }
                }
                .accessibilityIdentifier(
                    "sidebar-\(label.lowercased().replacingOccurrences(of: " ", with: "-"))-button"
                )
            }
            
            Spacer()
            
            Divider()
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            
            // User avatar
            VStack(spacing: 4) {
                Circle()
                    .fill(Color.spxTextSecondary.opacity(0.2))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.spxTextSecondary)
                    )
                Text("Vitaly Baum")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.spxTextSecondary)
            }
            .padding(.bottom, 16)
        }
        .frame(width: 108)
        .background(.ultraThinMaterial)
    }
}

struct SidebarItem: View {
    let icon: String
    let label: String
    let isActive: Bool
    let action: () -> Void
    
    @State private var isHovering = false
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .regular))
                    .symbolRenderingMode(.hierarchical)
                Text(label)
                    .font(.system(size: 10, weight: .medium))
            }
            .frame(width: 72, height: 64)
            .foregroundStyle(isActive ? Color.spxAccent : Color.spxTextSecondary)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isActive ? Color.spxAccent.opacity(0.15) : Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isActive ? Color.spxAccent.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
            )
            .contentShape(Rectangle())
            .scaleEffect(isHovering && !isActive ? 1.05 : 1.0)
            .brightness(isHovering && !isActive ? 0.1 : 0)
        }
        .buttonStyle(.plain)
        .focusEffectDisabled()
        .animation(.easeOut(duration: 0.15), value: isHovering)
        .onHover { hovering in
            isHovering = hovering
        }
    }
}
