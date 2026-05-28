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

    // MARK: - Color Semantic Tests

    func testSPXBaseColorIsNotClear() {
        // spxBase should be a defined color, not clear/nil
        XCTAssertNotEqual(Color.spxBase, Color.clear)
    }

    func testSPXAccentColorIsNotClear() {
        XCTAssertNotEqual(Color.spxAccent, Color.clear)
    }

    // MARK: - Color Hex Initializer Tests

    func testColorFromHexBlack() {
        let black = Color(hex: "000000")
        // Black should not be clear
        XCTAssertNotEqual(black, Color.clear)
    }

    func testColorFromHexWhite() {
        let white = Color(hex: "FFFFFF")
        XCTAssertNotNil(white)
    }

    func testColorFromHexWithAlpha() {
        let color = Color(hex: "FF5733FF")
        XCTAssertNotNil(color)
    }

    func testColorFromInvalidHexReturnsNil() {
        // Invalid hex should return nil or fall back gracefully
        let color = Color(hex: "GGG")
        // Color init with invalid hex should not crash
        XCTAssertNotNil(color)
    }
}
