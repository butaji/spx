import XCTest
import SwiftUI
@testable import SPX

final class ColorsTests: XCTestCase {

    // MARK: - SPXColors Values Non-Nil

    func testSPXColorsBgNonNil() {
        XCTAssertNotNil(SPXColors.bg)
    }

    func testSPXColorsBgElevatedNonNil() {
        XCTAssertNotNil(SPXColors.bgElevated)
    }

    func testSPXColorsBgHoverNonNil() {
        XCTAssertNotNil(SPXColors.bgHover)
    }

    func testSPXColorsSurfaceNonNil() {
        XCTAssertNotNil(SPXColors.surface)
    }

    func testSPXColorsSurfaceHoverNonNil() {
        XCTAssertNotNil(SPXColors.surfaceHover)
    }

    func testSPXColorsFgNonNil() {
        XCTAssertNotNil(SPXColors.fg)
    }

    func testSPXColorsFgSecondaryNonNil() {
        XCTAssertNotNil(SPXColors.fgSecondary)
    }

    func testSPXColorsFgMutedNonNil() {
        XCTAssertNotNil(SPXColors.fgMuted)
    }

    func testSPXColorsFgFaintNonNil() {
        XCTAssertNotNil(SPXColors.fgFaint)
    }

    func testSPXColorsAccentNonNil() {
        XCTAssertNotNil(SPXColors.accent)
    }

    func testSPXColorsAccentSubtleNonNil() {
        XCTAssertNotNil(SPXColors.accentSubtle)
    }

    func testSPXColorsAccentDimNonNil() {
        XCTAssertNotNil(SPXColors.accentDim)
    }

    func testSPXColorsDangerNonNil() {
        XCTAssertNotNil(SPXColors.danger)
    }

    func testSPXColorsEdgeNonNil() {
        XCTAssertNotNil(SPXColors.edge)
    }

    func testSPXColorsEdgeLightNonNil() {
        XCTAssertNotNil(SPXColors.edgeLight)
    }

    // MARK: - Color Extensions Non-Nil

    func testColorSpxBGNonNil() {
        XCTAssertNotNil(Color.spxBG)
    }

    func testColorSpxBGElevatedNonNil() {
        XCTAssertNotNil(Color.spxBGElevated)
    }

    func testColorSpxBGHoverNonNil() {
        XCTAssertNotNil(Color.spxBGHover)
    }

    func testColorSpxSurfaceNonNil() {
        XCTAssertNotNil(Color.spxSurface)
    }

    func testColorSpxFGNonNil() {
        XCTAssertNotNil(Color.spxFG)
    }

    func testColorSpxFGSecondaryNonNil() {
        XCTAssertNotNil(Color.spxFGSecondary)
    }

    func testColorSpxFGMutedNonNil() {
        XCTAssertNotNil(Color.spxFGMuted)
    }

    func testColorSpxFGFaintNonNil() {
        XCTAssertNotNil(Color.spxFGFaint)
    }

    func testColorSpxAccentNonNil() {
        XCTAssertNotNil(Color.spxAccent)
    }

    func testColorSpxDangerNonNil() {
        XCTAssertNotNil(Color.spxDanger)
    }

    func testColorSpxEdgeNonNil() {
        XCTAssertNotNil(Color.spxEdge)
    }

    func testColorSpxEdgeLightNonNil() {
        XCTAssertNotNil(Color.spxEdgeLight)
    }

    // MARK: - SPXSpacing Values

    func testSPXSpacingValuesExist() {
        XCTAssertGreaterThan(SPXSpacing.x1, 0)
        XCTAssertGreaterThan(SPXSpacing.x2, SPXSpacing.x1)
        XCTAssertGreaterThan(SPXSpacing.x3, SPXSpacing.x2)
        XCTAssertGreaterThan(SPXSpacing.x4, SPXSpacing.x3)
        XCTAssertGreaterThan(SPXSpacing.x5, SPXSpacing.x4)
        XCTAssertGreaterThan(SPXSpacing.x6, SPXSpacing.x5)
        XCTAssertGreaterThan(SPXSpacing.x7, SPXSpacing.x6)
        XCTAssertGreaterThan(SPXSpacing.x8, SPXSpacing.x7)
        XCTAssertGreaterThan(SPXSpacing.x10, SPXSpacing.x8)
        XCTAssertGreaterThan(SPXSpacing.x12, SPXSpacing.x10)
    }

    // MARK: - SPXRadius Values

    func testSPXRadiusValuesExist() {
        XCTAssertGreaterThan(SPXRadius.sm, 0)
        XCTAssertGreaterThan(SPXRadius.md, SPXRadius.sm)
        XCTAssertGreaterThan(SPXRadius.lg, SPXRadius.md)
        XCTAssertGreaterThan(SPXRadius.xl, SPXRadius.lg)
        XCTAssertGreaterThan(SPXRadius.full, SPXRadius.xl)
    }
}
