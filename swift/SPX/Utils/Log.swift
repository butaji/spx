import OSLog

enum Log {
    static let subsystem = "com.spx"

    static let network = Logger(subsystem: subsystem, category: "Network")
    static let auth = Logger(subsystem: subsystem, category: "Auth")
    static let playback = Logger(subsystem: subsystem, category: "Playback")
    static let ui = Logger(subsystem: subsystem, category: "UI")
    static let cast = Logger(subsystem: subsystem, category: "Cast")
    static let lifecycle = Logger(subsystem: subsystem, category: "Lifecycle")
    static let hotkeys = Logger(subsystem: subsystem, category: "Hotkeys")

    static func debug(_ message: String, category: Logger = Log.network) {
        category.debug("\(message)")
    }

    static func info(_ message: String, category: Logger = Log.network) {
        category.info("\(message)")
    }

    static func error(_ message: String, category: Logger = Log.network) {
        category.error("\(message)")
    }
}
