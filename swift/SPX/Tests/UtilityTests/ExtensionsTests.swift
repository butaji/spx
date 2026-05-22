import XCTest
import SwiftUI
@testable import SPX

final class ExtensionsTests: XCTestCase {

    // MARK: - Color(hex:) 6-char hex

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
    }

    func testColorHex6CharBlack() {
        let color = Color(hex: "000000")
        XCTAssertNotNil(color)
    }

    func testColorHex6CharWhite() {
        let color = Color(hex: "ffffff")
        XCTAssertNotNil(color)
    }

    // MARK: - Color(hex:) 3-char hex

    func testColorHex3CharWhite() {
        let color = Color(hex: "#fff")
        XCTAssertNotNil(color)
    }

    func testColorHex3CharBlack() {
        let color = Color(hex: "000")
        XCTAssertNotNil(color)
    }

    func testColorHex3CharRed() {
        // #f00 expands to #ff0000
        let color = Color(hex: "f00")
        XCTAssertNotNil(color)
    }

    func testColorHex3CharMixed() {
        // #abc expands to #aabbcc
        let color = Color(hex: "#abc")
        XCTAssertNotNil(color)
    }

    // MARK: - Color(hex:) invalid hex

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
        let result = String.formatDuration(ms: 125000)
        XCTAssertEqual(result, "2:05")
    }

    func testFormatDurationZero() {
        let result = String.formatDuration(ms: 0)
        XCTAssertEqual(result, "0:00")
    }

    func testFormatDurationOneSecond() {
        let result = String.formatDuration(ms: 1000)
        XCTAssertEqual(result, "0:01")
    }

    func testFormatDurationOneMinute() {
        let result = String.formatDuration(ms: 60000)
        XCTAssertEqual(result, "1:00")
    }

    func testFormatDuration59Seconds() {
        let result = String.formatDuration(ms: 59000)
        XCTAssertEqual(result, "0:59")
    }

    // MARK: - Time Formatting (formatDurationLong) with hours

    func testFormatDurationLong3661000ms() {
        // 3661000ms = 3661 seconds
        // 3661 / 3600 = 1 hour remainder 61 seconds
        // So format is 1:01:01 (1 hour, 1 minute, 1 second)
        let result = String.formatDurationLong(ms: 3661000)
        XCTAssertEqual(result, "1:01:01")
    }

    func testFormatDurationLongOneHour() {
        // 1 hour = 3600000ms
        let result = String.formatDurationLong(ms: 3600000)
        XCTAssertEqual(result, "1:00:00")
    }

    func testFormatDurationLongOneHourOneMinute() {
        // 1 hour 1 minute = 3600000 + 60000 = 3660000ms
        let result = String.formatDurationLong(ms: 3660000)
        XCTAssertEqual(result, "1:01:00")
    }

    func testFormatDurationLongTwoHours() {
        let result = String.formatDurationLong(ms: 7200000)
        XCTAssertEqual(result, "2:00:00")
    }

    func testFormatDurationLongLessThanOneHour() {
        // Should NOT show hours if < 1 hour
        let result = String.formatDurationLong(ms: 3599000)
        XCTAssertEqual(result, "59:59")
    }

    func testFormatDurationLongExactHourBoundary() {
        // 3599000 is 59:59, so 3600000 is exactly 1:00:00
        let result = String.formatDurationLong(ms: 3600000)
        XCTAssertEqual(result, "1:00:00")
    }
}
