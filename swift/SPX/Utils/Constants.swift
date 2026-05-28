import Foundation
import SwiftUI

// MARK: - Constants

enum Constants {
    // MARK: - Network
    enum Network {
        static let oauthCallbackPort: UInt16 = 1422
        static let castPort: UInt16 = 8009
        static let receiveBufferSize = 65536
    }

    // MARK: - Image Sizes
    enum ImageSize {
        static let albumArtwork: CGFloat = 240
        static let artworkHero: CGFloat = 160
        static let authOrbLarge: CGFloat = 500
        static let authOrbMedium: CGFloat = 400
        static let authOrbSmall: CGFloat = 350
        static let authOrbTiny: CGFloat = 300
    }

    // MARK: - Timing
    enum Timing {
        static let searchDebounce: TimeInterval = 0.5
        static let heartbeatInterval: TimeInterval = 5.0
        static let castTimeout: TimeInterval = 10.0
    }

    // MARK: - OAuth
    enum OAuth {
        static let stateLength: Int = 16
    }
}
