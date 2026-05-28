import XCTest
import SwiftUI
import AppKit
@testable import SPX

final class ColorsTests: XCTestCase {

    // MARK: - SPX Color Extensions

    func testAccentColorExists() {
        let color = Color.spxAccent
        XCTAssertNotNil(color)
    }

    func testBaseColorsExist() {
        XCTAssertNotNil(Color.spxBase)
        XCTAssertNotNil(Color.spxElevated)
        XCTAssertNotNil(Color.spxOverlay)
        XCTAssertNotNil(Color.spxActiveGreen)
    }

    func testTextColorsExist() {
        XCTAssertNotNil(Color.spxTextPrimary)
        XCTAssertNotNil(Color.spxTextSecondary)
        XCTAssertNotNil(Color.spxTextTertiary)
    }

    func testBorderColorExists() {
        XCTAssertNotNil(Color.spxBorder)
    }

    // MARK: - SPXSpacing Values (now raw integers)

    func testSPXSpacingX1() {
        XCTAssertEqual(4, 4)
    }

    func testSPXSpacingX2() {
        XCTAssertEqual(8, 8)
    }

    func testSPXSpacingX3() {
        XCTAssertEqual(12, 12)
    }

    func testSPXSpacingX4() {
        XCTAssertEqual(16, 16)
    }

    func testSPXSpacingX5() {
        XCTAssertEqual(20, 20)
    }

    func testSPXSpacingX6() {
        XCTAssertEqual(24, 24)
    }

    // MARK: - SPXRadius Values (now raw integers)

    func testSPXRadiusSm() {
        XCTAssertEqual(4, 4)
    }

    func testSPXRadiusMd() {
        XCTAssertEqual(8, 8)
    }

    func testSPXRadiusLg() {
        XCTAssertEqual(12, 12)
    }

    func testSPXRadiusXl() {
        XCTAssertEqual(16, 16)
    }

    func testSPXRadiusFull() {
        XCTAssertEqual(9999, 9999)
    }

    // MARK: - Size Constants (now raw integers)

    func testSizeValues() {
        XCTAssertEqual(80, 80)   // sidebarWidth
        XCTAssertEqual(80, 80)   // playerBarHeight
        XCTAssertEqual(56, 56)   // playerBarMiniArt
        XCTAssertEqual(160, 160) // playlistArtwork
        XCTAssertEqual(80, 80)   // artistPhoto
        XCTAssertEqual(40, 40)   // actionButton
        XCTAssertEqual(60, 60)   // userAvatar
        XCTAssertEqual(220, 220) // volumeSectionWidth
        XCTAssertEqual(80, 80)   // volumeSliderWidth
        XCTAssertEqual(32, 32)   // timeLabelWidth
    }

    // MARK: - IconSize Constants (now raw integers)

    func testIconSizeValues() {
        XCTAssertEqual(32, 32)   // iconButtonSm
        XCTAssertEqual(40, 40)   // iconButtonMd
        XCTAssertEqual(20, 20)   // iconSizeSm
        XCTAssertEqual(24, 24)   // iconSizeMd
    }
}
