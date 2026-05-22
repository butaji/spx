import SwiftUI

enum SidebarItem: String, CaseIterable, Identifiable {
    case nowPlaying = "Now Playing"
    case search = "Search"
    case library = "Library"
    case queue = "Queue"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .nowPlaying: return "square.grid.2x2"
        case .search: return "magnifyingglass"
        case .library: return "music.note"
        case .queue: return "plus"
        }
    }
}

struct SidebarView: View {
    @Binding var selectedItem: SidebarItem
    @State private var hoveredItem: SidebarItem?

    private let fgSecondary = Color(hex: "#a0a0a0")
    private let fg = Color(hex: "#f5f5f5")
    private let bgHover = Color(hex: "#1a1a1a")
    private let accent = Color(hex: "#1DB954")
    private let accentDim = Color(hex: "#1DB954").opacity(0.2)
    private let fgFaint = Color(hex: "#555555")

    var body: some View {
        VStack(spacing: 2) {
            ForEach(SidebarItem.allCases) { item in
                navButton(for: item)
            }

            Spacer()

            footerView
        }
        .padding(.horizontal, 8)
        .padding(.top, 16)
        .frame(width: 110)
        .background(Color(hex: "#111111"))
    }

    @ViewBuilder
    private func navButton(for item: SidebarItem) -> some View {
        let isActive = selectedItem == item
        let isHovered = hoveredItem == item

        Button(action: { selectedItem = item }) {
            VStack(spacing: 4) {
                Image(systemName: item.icon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(isActive ? accent : (isHovered ? fg : fgSecondary))

                Text(item.rawValue)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isActive ? accent : (isHovered ? fg : fgSecondary))
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isActive ? accentDim : (isHovered ? bgHover : Color.clear))
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            hoveredItem = hovering ? item : nil
        }
    }

    private var footerView: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(fgSecondary.opacity(0.3))
                .frame(width: 32, height: 32)
                .overlay(
                    Text("U")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(fg)
                )

            Text("username")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(fgFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
