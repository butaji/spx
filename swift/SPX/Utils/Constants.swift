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

    // MARK: - UI Dimensions (deprecated - use SPXSize tokens)
    enum Layout {
        static let sidebarWidth: CGFloat = 80
        static let playerBarHeight: CGFloat = 80
        static let playerBarContentHeight: CGFloat = 54
        static let playerBarVolumeWidth: CGFloat = 180
        static let volumeSliderWidth: CGFloat = 100
        static let timeLabelWidth: CGFloat = 40
        static let gridMinimumWidth: CGFloat = 160

        enum ContentPadding {
            static let top: CGFloat = 32
            static let leading: CGFloat = 32
            static let bottom: CGFloat = 48
            static let trailing: CGFloat = 32
        }
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

    // MARK: - Calculation
    enum Calculation {
        static let popularityDivisor: Double = 100.0
    }
}
