import SwiftUI

@main
struct SPXApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
        .defaultSize(width: 900, height: 580)
        .windowResizability(.contentSize)
    }
}
