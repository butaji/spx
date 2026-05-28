import SwiftUI

// MARK: - onTapOutside Extension

extension View {
    func onTapOutside(perform action: @escaping () -> Void) -> some View {
        self.background(
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture {
                    action()
                }
        )
    }
}

// MARK: - DeviceSelectorView

struct DeviceSelectorView: View {
    var devices: [SpotifyDevice] = []
    var currentDeviceId: String?
    var isRefreshing: Bool = false
    var onSelectDevice: ((String) -> Void)?
    var onRefresh: (() -> Void)?

    @State private var isExpanded: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Button showing current device
            deviceButton

            // Dropdown panel
            if isExpanded {
                dropdownPanel
            }
        }
        .background(Color.spxElevated)
        .onTapOutside {
            isExpanded = false
        }
    }

    // MARK: - Device Button

    private var deviceButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded.toggle()
            }
        } label: {
            HStack(spacing: 8) {
                deviceIcon

                Text(currentDeviceName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.spxTextPrimary)

                Image(systemName: "chevron.down")
                    .font(.system(size: 8))
                    .foregroundColor(Color.spxTextSecondary)
                    .rotationEffect(.degrees(isExpanded ? 180 : 0))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.spxElevated)
            .cornerRadius(20)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Select playback device")
    }

    private var currentDeviceName: String {
        devices.first { $0.id == currentDeviceId }?.name ?? "Select Device"
    }

    private var deviceIcon: some View {
        Group {
            if let device = devices.first(where: { $0.id == currentDeviceId }),
               let type = device.type {
                switch type.lowercased() {
                case "computer":
                    Image(systemName: "laptopcomputer")
                case "smartphone", "phone":
                    Image(systemName: "iphone")
                case "tablet":
                    Image(systemName: "ipad")
                case "tv", "videointv":
                    Image(systemName: "tv")
                case "speaker":
                    Image(systemName: "hifispeaker")
                default:
                    Image(systemName: "waveform")
                }
            } else {
                Image(systemName: "waveform")
            }
        }
        .font(.system(size: 14))
        .foregroundColor(Color.spxAccent)
    }

    // MARK: - Dropdown Panel

    private var dropdownPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with refresh
            HStack {
                Text("Connect to a device")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color.spxTextSecondary)

                Spacer()

                Button {
                    onRefresh?()
                } label: {
                    if isRefreshing {
                        ProgressView()
                            .progressViewStyle(
                                CircularProgressViewStyle(
                                    tint: Color.spxTextSecondary
                                )
                            )
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12))
                            .foregroundColor(Color.spxTextSecondary)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Refresh devices")
                .accessibilityIdentifier("refresh-devices-button")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.spxElevated)

            Divider()
                .background(Color.spxBorder)

            // Device list
            VStack(spacing: 0) {
                ForEach(devices) { device in
                    deviceRow(device)
                    if device.id != devices.last?.id {
                        Divider()
                            .background(Color.spxBorder)
                    }
                }
            }
            .background(Color.spxElevated)
        }
        .frame(minWidth: 220)
        .cornerRadius(8)
        .shadow(color: Color.black.opacity(0.3), radius: 10, x: 0, y: 5)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.spxBorder, lineWidth: 1)
        )
        .padding(.top, 8)
    }

    // MARK: - Device Row

    private func deviceRow(_ device: SpotifyDevice) -> some View {
        Button {
            if let id = device.id {
                onSelectDevice?(id)
            }
            withAnimation(.easeInOut(duration: 0.2)) {
                isExpanded = false
            }
        } label: {
            deviceRowContent(device)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(device.name ?? "Unknown Device")
    }

    private func deviceRowContent(_ device: SpotifyDevice) -> some View {
        HStack(spacing: 12) {
            deviceRowIcon(device.type)
            deviceRowInfo(device)
            Spacer()
            activeIndicator(device)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            device.id == currentDeviceId ? Color.spxOverlay : Color.clear
        )
    }

    private func deviceRowIcon(_ type: String?) -> some View {
        Group {
            switch type?.lowercased() {
            case "computer":
                Image(systemName: "laptopcomputer")
            case "smartphone", "phone":
                Image(systemName: "iphone")
            case "tablet":
                Image(systemName: "ipad")
            case "tv", "videointv":
                Image(systemName: "tv")
            case "speaker":
                Image(systemName: "hifispeaker")
            default:
                Image(systemName: "waveform")
            }
        }
        .font(.system(size: 14))
        .foregroundColor(Color.spxTextSecondary)
        .frame(width: 20)
    }

    private func deviceRowInfo(_ device: SpotifyDevice) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(device.name ?? "Unknown Device")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(Color.spxTextPrimary)
                .lineLimit(1)

            Text(device.type?.capitalized ?? "Unknown")
                .font(.system(size: 10))
                .foregroundColor(Color.spxTextTertiary)
        }
    }

    @ViewBuilder
    private func activeIndicator(_ device: SpotifyDevice) -> some View {
        if device.id == currentDeviceId {
            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Color.spxAccent)
        }
    }
}

// MARK: - Preview

#Preview {
    let macBook = SpotifyDevice(
        id: "1",
        name: "MacBook Pro",
        volumePercent: nil,
        type: "Computer",
        isActive: true,
        isPrivateSession: nil,
        isRestricted: nil,
        supportsVolume: nil,
        isLocal: nil,
        localNote: nil,
        canTransfer: nil,
        needsWakeUp: nil,
        deviceIp: nil
    )

    let iPhone = SpotifyDevice(
        id: "2",
        name: "iPhone 15",
        volumePercent: nil,
        type: "Smartphone",
        isActive: false,
        isPrivateSession: nil,
        isRestricted: nil,
        supportsVolume: nil,
        isLocal: nil,
        localNote: nil,
        canTransfer: nil,
        needsWakeUp: nil,
        deviceIp: nil
    )

    let spotifyConnect = SpotifyDevice(
        id: "3",
        name: "Spotify Connect",
        volumePercent: nil,
        type: "Audio",
        isActive: false,
        isPrivateSession: nil,
        isRestricted: nil,
        supportsVolume: nil,
        isLocal: nil,
        localNote: nil,
        canTransfer: nil,
        needsWakeUp: nil,
        deviceIp: nil
    )

    VStack {
        Spacer()
        DeviceSelectorView(
            devices: [macBook, iPhone, spotifyConnect],
            currentDeviceId: "1"
        )
        .padding(40)
    }
    .frame(width: 300, height: 200)
    .background(Color.spxBase)
}
