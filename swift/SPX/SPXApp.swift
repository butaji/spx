import SwiftUI
import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let window = NSApplication.shared.windows.first else { return }
        
        // Transparent title bar with traffic lights
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.styleMask.insert(.fullSizeContentView)
        
        // Rounded corners
        window.contentView?.wantsLayer = true
        window.contentView?.layer?.cornerRadius = 12
        window.contentView?.layer?.masksToBounds = true
        
        // Hide title text
        window.title = ""
        
        // Background
        window.backgroundColor = NSColor(Color.spxBase)
        window.isOpaque = true
        window.hasShadow = true
    }
}

@main
struct SPXApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    private let spotifyAPI: SpotifyAPI
    private let tokenStorage: TokenStorage
    private let appState: AppState
    private let isPreviewMode: Bool

    init() {
        let preview = ProcessInfo.processInfo.environment["SPX_MOCK"] == "1"
        self.isPreviewMode = preview
        self.spotifyAPI = SpotifyAPI.shared
        self.tokenStorage = preview ? MockTokenStorage() : TokenStorage.shared

        let state = AppState(
            spotifyService: spotifyAPI,
            tokenStorage: tokenStorage
        )
        if preview {
            state.populateMockData()
        }
        self.appState = state
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .background(Color.spxBase)
                .environment(appState)
                .environment(appState.auth)
                .environment(appState.playback)
                .environment(appState.navigation)
                .environment(appState.devices)
                .frame(minWidth: 800, minHeight: 600)
        }
        .defaultSize(width: 1200, height: 800)
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About SPX") {
                    NSApp.orderFrontStandardAboutPanel(nil)
                }
            }

            CommandMenu("Playback") {
                Button("Play/Pause") {
                    Task { await appState.handlePlayPause() }
                }
                .keyboardShortcut(.space, modifiers: [])

                Button("Next Track") {
                    Task { await appState.handleNext() }
                }
                .keyboardShortcut(.rightArrow, modifiers: [.command])

                Button("Previous Track") {
                    Task { await appState.handlePrev() }
                }
                .keyboardShortcut(.leftArrow, modifiers: [.command])

                Divider()

                Button("Toggle Shuffle") {
                    Task { await appState.handleShuffle() }
                }
                .keyboardShortcut("s", modifiers: [.command])

                Button("Cycle Repeat") {
                    Task { await appState.handleRepeat() }
                }
                .keyboardShortcut("r", modifiers: [.command])
            }

            CommandMenu("Navigate") {
                Button("Home") {
                    appState.navigate(to: .home)
                }
                .keyboardShortcut("1", modifiers: [.command])

                Button("Search") {
                    appState.navigate(to: .search)
                }
                .keyboardShortcut("2", modifiers: [.command])

                Button("Library") {
                    appState.navigate(to: .library(tab: nil))
                }
                .keyboardShortcut("3", modifiers: [.command])

                Button("Queue") {
                    appState.navigate(to: .queue)
                }
                .keyboardShortcut("4", modifiers: [.command])
            }
        }
    }
}
