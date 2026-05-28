import SwiftUI
import Carbon.HIToolbox
import os.log

class HotkeyManager: ObservableObject {
    private var monitor: Any?
    weak var appState: AppState?
    private let logger = Logger(subsystem: "com.spx", category: "Hotkeys")

    func start(appState: AppState) {
        guard monitor == nil else {
            logger.debug("Hotkey monitor already registered")
            return
        }
        self.appState = appState
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self else { return event }
            let consumed = self.handle(event)
            return consumed ? nil : event
        }
        logger.info("Hotkey monitor registered")
    }

    func stop() {
        if let monitor = monitor {
            NSEvent.removeMonitor(monitor)
            self.monitor = nil
            logger.info("Hotkey monitor removed")
        }
    }

    nonisolated private func handle(_ event: NSEvent) -> Bool {
        let hasCmd = event.modifierFlags.contains(.command)
        let keyCode = Int(event.keyCode)
        let chars = event.charactersIgnoringModifiers ?? ""

        logger.debug("Key event: code=\(keyCode) chars='\(chars)' cmd=\(hasCmd)")

        if hasCmd {
            return handleCommand(keyCode: keyCode)
        }
        return handleRegular(keyCode: keyCode)
    }

    nonisolated private func handleCommand(keyCode: Int) -> Bool {
        if handleNavigationCommand(keyCode: keyCode) {
            return true
        }
        if handlePlaybackCommand(keyCode: keyCode) {
            return true
        }
        return false
    }

    nonisolated private func handleNavigationCommand(keyCode: Int) -> Bool {
        switch keyCode {
        case kVK_ANSI_1: navigate(to: .home); logger.info("Cmd+1 -> Home"); return true
        case kVK_ANSI_2: navigate(to: .search); logger.info("Cmd+2 -> Search"); return true
        case kVK_ANSI_3: navigate(to: .library(tab: nil)); logger.info("Cmd+3 -> Library"); return true
        case kVK_ANSI_4: navigate(to: .queue); logger.info("Cmd+4 -> Queue"); return true
        default: return false
        }
    }

    nonisolated private func handlePlaybackCommand(keyCode: Int) -> Bool {
        switch keyCode {
        case kVK_LeftArrow: trigger { await $0.handlePrev() }; logger.info("Cmd+Left -> Prev"); return true
        case kVK_RightArrow: trigger { await $0.handleNext() }; logger.info("Cmd+Right -> Next"); return true
        case kVK_UpArrow: trigger { await $0.handleVolumeUp() }; logger.info("Cmd+Up -> VolUp"); return true
        case kVK_DownArrow: trigger { await $0.handleVolumeDown() }; logger.info("Cmd+Down -> VolDown"); return true
        default: return false
        }
    }

    nonisolated private func handleRegular(keyCode: Int) -> Bool {
        switch keyCode {
        case kVK_Space:
            // Don't consume Space if user is typing
            if let window = NSApp.keyWindow,
               let responder = window.firstResponder,
               responder is NSTextView || responder is NSTextField || responder is NSSearchField {
                return false  // Let text field handle it
            }
            trigger { await $0.handlePlayPause() }
            logger.info("Space -> PlayPause")
            return true
        case kVK_ANSI_L: trigger { await $0.handleToggleLike() }; logger.info("L -> Like"); return true
        case kVK_ANSI_S: trigger { await $0.handleShuffle() }; logger.info("S -> Shuffle"); return true
        case kVK_ANSI_R: trigger { await $0.handleRepeat() }; logger.info("R -> Repeat"); return true
        case kVK_ANSI_M: trigger { await $0.handleToggleMute() }; logger.info("M -> Mute"); return true
        case kVK_ANSI_Slash: navigate(to: .search); logger.info("/ -> Search"); return true
        case kVK_Escape: logger.info("Escape"); return true
        default: return false
        }
    }

    nonisolated private func navigate(to view: AppView) {
        Task { @MainActor in self.appState?.currentView = view }
    }

    nonisolated private func trigger(_ action: @escaping @MainActor (AppState) async -> Void) {
        Task { @MainActor in
            if let appState = self.appState {
                await action(appState)
            }
        }
    }
}
