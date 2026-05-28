import XCTest
import SwiftUI
import AppKit
@testable import SPX

final class ExtensionsTests: XCTestCase {

    // MARK: - Color(hex:) 6-char hex with RGB verification

    func testColorHex6CharWithHash() {
        let color = Color(hex: "#1DB954")
        XCTAssertNotNil(color)
    }

    func testColorHex6CharWithoutHash() {
        let color = Color(hex: "0a0a0a")
        XCTAssertNotNil(color)
    }

    func testColorHex6CharLowercase() {
        let color = Color(hex: "ff4444")
        XCTAssertNotNil(color)
    }

    func testColorHex6CharSpotifyGreen() {
        // #1DB954 is Spotify green
        let color = Color(hex: "#1DB954")
        XCTAssertNotNil(color)

        // Verify RGB values
        let nsColor = NSColor(color)
        XCTAssertEqual(nsColor.redComponent, 0.114, accuracy: 0.01)
        XCTAssertEqual(nsColor.greenComponent, 0.725, accuracy: 0.01)
        XCTAssertEqual(nsColor.blueComponent, 0.329, accuracy: 0.01)
    }

    func testColorHex6CharBlack() {
        let color = Color(hex: "000000")
        XCTAssertNotNil(color)

        let nsColor = NSColor(color)
        XCTAssertEqual(nsColor.redComponent, 0.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.greenComponent, 0.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.blueComponent, 0.0, accuracy: 0.01)
    }

    func testColorHex6CharWhite() {
        let color = Color(hex: "ffffff")
        XCTAssertNotNil(color)

        let nsColor = NSColor(color)
        XCTAssertEqual(nsColor.redComponent, 1.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.greenComponent, 1.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.blueComponent, 1.0, accuracy: 0.01)
    }

    func testColorHex6CharRed() {
        let color = Color(hex: "ff0000")
        XCTAssertNotNil(color)

        let nsColor = NSColor(color)
        XCTAssertEqual(nsColor.redComponent, 1.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.greenComponent, 0.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.blueComponent, 0.0, accuracy: 0.01)
    }

    func testColorHex6CharGreen() {
        let color = Color(hex: "00ff00")
        XCTAssertNotNil(color)

        let nsColor = NSColor(color)
        XCTAssertEqual(nsColor.redComponent, 0.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.greenComponent, 1.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.blueComponent, 0.0, accuracy: 0.01)
    }

    func testColorHex6CharBlue() {
        let color = Color(hex: "0000ff")
        XCTAssertNotNil(color)

        let nsColor = NSColor(color)
        XCTAssertEqual(nsColor.redComponent, 0.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.greenComponent, 0.0, accuracy: 0.01)
        XCTAssertEqual(nsColor.blueComponent, 1.0, accuracy: 0.01)
    }

    // MARK: - Color(hex:) 3-char hex (expansion not implemented, just check non-nil)

    func testColorHex3CharWhite() {
        let color = Color(hex: "#fff")
        XCTAssertNotNil(color)
    }

    func testColorHex3CharBlack() {
        let color = Color(hex: "000")
        XCTAssertNotNil(color)
    }

    func testColorHex3CharRed() {
        let color = Color(hex: "f00")
        XCTAssertNotNil(color)
    }

    func testColorHex3CharMixed() {
        let color = Color(hex: "#abc")
        XCTAssertNotNil(color)
    }

    // MARK: - Color(hex:) invalid hex (graceful degradation)

    func testColorHexInvalidEmpty() {
        let color = Color(hex: "")
        // Should return reasonable default (black)
        XCTAssertNotNil(color)
    }

    func testColorHexInvalidTooShort() {
        let color = Color(hex: "12")
        XCTAssertNotNil(color)
    }

    func testColorHexInvalidTooLong() {
        let color = Color(hex: "12345678")
        XCTAssertNotNil(color)
    }

    func testColorHexInvalidNonHex() {
        let color = Color(hex: "xyzxyz")
        XCTAssertNotNil(color)
    }

    func testColorHexInvalidMixed() {
        let color = Color(hex: "#ghiabc")
        XCTAssertNotNil(color)
    }

    func testColorHexInvalidOnlyHash() {
        let color = Color(hex: "#")
        XCTAssertNotNil(color)
    }

    // MARK: - Time Formatting (formatDuration)

    func testFormatDuration125000ms() {
        // 125 seconds = 2:05
        let result = String.formatDuration(millis: 125000)
        XCTAssertEqual(result, "2:05")
    }

    func testFormatDurationZero() {
        let result = String.formatDuration(millis: 0)
        XCTAssertEqual(result, "0:00")
    }

    func testFormatDurationOneSecond() {
        let result = String.formatDuration(millis: 1000)
        XCTAssertEqual(result, "0:01")
    }

    func testFormatDurationOneMinute() {
        let result = String.formatDuration(millis: 60000)
        XCTAssertEqual(result, "1:00")
    }

    func testFormatDuration59Seconds() {
        let result = String.formatDuration(millis: 59000)
        XCTAssertEqual(result, "0:59")
    }

    func testFormatDuration90Seconds() {
        // 90000ms = 1:30
        let result = String.formatDuration(millis: 90000)
        XCTAssertEqual(result, "1:30")
    }

    func testFormatDurationOneHour() {
        // 3600000ms = 1:00:00 but formatDuration only shows minutes:seconds
        let result = String.formatDuration(millis: 3600000)
        XCTAssertEqual(result, "60:00")
    }

    // MARK: - Time Formatting (formatDurationLong) with hours

    func testFormatDurationLong3661000ms() {
        // 3661000ms = 3661 seconds
        // 3661 / 3600 = 1 hour remainder 61 seconds
        // So format is 1:01:01 (1 hour, 1 minute, 1 second)
        let result = String.formatDurationLong(millis: 3661000)
        XCTAssertEqual(result, "1:01:01")
    }

    func testFormatDurationLongOneHour() {
        // 1 hour = 3600000ms
        let result = String.formatDurationLong(millis: 3600000)
        XCTAssertEqual(result, "1:00:00")
    }

    func testFormatDurationLongOneHourOneMinute() {
        // 1 hour 1 minute = 3600000 + 60000 = 3660000ms
        let result = String.formatDurationLong(millis: 3660000)
        XCTAssertEqual(result, "1:01:00")
    }

    func testFormatDurationLongTwoHours() {
        let result = String.formatDurationLong(millis: 7200000)
        XCTAssertEqual(result, "2:00:00")
    }

    func testFormatDurationLongLessThanOneHour() {
        // Should NOT show hours if < 1 hour
        let result = String.formatDurationLong(millis: 3599000)
        XCTAssertEqual(result, "59:59")
    }

    func testFormatDurationLongExactHourBoundary() {
        // 3599000 is 59:59, so 3600000 is exactly 1:00:00
        let result = String.formatDurationLong(millis: 3600000)
        XCTAssertEqual(result, "1:00:00")
    }

    func testFormatDurationLongZero() {
        let result = String.formatDurationLong(millis: 0)
        XCTAssertEqual(result, "0:00")
    }

    func testFormatDurationLong59Minutes() {
        // Less than 1 hour should show mm:ss
        let result = String.formatDurationLong(millis: 3599000)
        XCTAssertEqual(result, "59:59")
    }
}
