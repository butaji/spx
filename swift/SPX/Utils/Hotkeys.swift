import SwiftUI
import Carbon.HIToolbox

class HotkeyManager: ObservableObject {
    private var monitor: Any?
    weak var appState: AppState?

    func start(appState: AppState) {
        self.appState = appState
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self else { return event }
            let consumed = self.handle(event)
            return consumed ? nil : event
        }
    }

    func stop() {
        if let monitor = monitor {
            NSEvent.removeMonitor(monitor)
        }
    }

    nonisolated private func handle(_ event: NSEvent) -> Bool {
        let hasCmd = event.modifierFlags.contains(.command)
        let keyCode = Int(event.keyCode)

        if hasCmd {
            return handleCommand(keyCode: keyCode)
        }
        return handleRegular(keyCode: keyCode)
    }

    nonisolated private func handleCommand(keyCode: Int) -> Bool {
        switch keyCode {
        case kVK_ANSI_1: navigate(to: .home); return true
        case kVK_ANSI_2: navigate(to: .search); return true
        case kVK_ANSI_3: navigate(to: .library(tab: nil)); return true
        case kVK_ANSI_4: navigate(to: .queue); return true
        case kVK_LeftArrow: trigger { $0.handlePrev() }; return true
        case kVK_RightArrow: trigger { $0.handleNext() }; return true
        case kVK_UpArrow: trigger { $0.handleVolumeUp() }; return true
        case kVK_DownArrow: trigger { $0.handleVolumeDown() }; return true
        default: return false
        }
    }

    nonisolated private func handleRegular(keyCode: Int) -> Bool {
        switch keyCode {
        case kVK_Space: trigger { $0.handlePlayPause() }; return true
        case kVK_ANSI_L: trigger { $0.handleToggleLike() }; return true
        case kVK_ANSI_S: trigger { $0.handleShuffle() }; return true
        case kVK_ANSI_R: trigger { $0.handleRepeat() }; return true
        case kVK_ANSI_M: trigger { $0.handleToggleMute() }; return true
        case kVK_ANSI_Slash: navigate(to: .search); return true
        case kVK_Escape: return true
        default: return false
        }
    }

    nonisolated private func navigate(to view: AppView) {
        Task { @MainActor in self.appState?.currentView = view }
    }

    nonisolated private func trigger(_ action: @escaping @MainActor (AppState) -> Void) {
        Task { @MainActor in
            if let appState = self.appState {
                action(appState)
            }
        }
    }
}
