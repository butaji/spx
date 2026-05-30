import XCTest
@testable import SPX

// MARK: - SpotifyDeviceCodingKeysTests

final class SpotifyDeviceCodingKeysTests: XCTestCase {

    // MARK: - CodingKeys Tests

    func testSpotifyDeviceCodingKeysVolumePercent() throws {
        let json = Data("""
        {
            "id": "codingKeysVol",
            "volume_percent": 80
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 80)
    }

    func testSpotifyDeviceCodingKeysIsActive() throws {
        let json = Data("""
        {
            "id": "codingKeysActive",
            "is_active": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isActive, true)
    }

    func testSpotifyDeviceCodingKeysIsPrivateSession() throws {
        let json = Data("""
        {
            "id": "codingKeysPrivate",
            "is_private_session": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isPrivateSession, true)
    }

    func testSpotifyDeviceCodingKeysIsRestricted() throws {
        let json = Data("""
        {
            "id": "codingKeysRestricted",
            "is_restricted": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isRestricted, true)
    }

    func testSpotifyDeviceCodingKeysSupportsVolume() throws {
        let json = Data("""
        {
            "id": "codingKeysVolSupport",
            "supports_volume": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.supportsVolume, true)
    }

    func testSpotifyDeviceCodingKeysIsLocal() throws {
        let json = Data("""
        {
            "id": "codingKeysLocal",
            "isLocal": false
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isLocal, false)
    }

    func testSpotifyDeviceCodingKeysLocalNote() throws {
        let json = Data("""
        {
            "id": "codingKeysNote",
            "localNote": "Test note"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.localNote, "Test note")
    }

    func testSpotifyDeviceCodingKeysCanTransfer() throws {
        let json = Data("""
        {
            "id": "codingKeysTransfer",
            "canTransfer": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.canTransfer, true)
    }

    func testSpotifyDeviceCodingKeysNeedsWakeUp() throws {
        let json = Data("""
        {
            "id": "codingKeysWakeUp",
            "needsWakeUp": false
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.needsWakeUp, false)
    }

    func testSpotifyDeviceCodingKeysDeviceIp() throws {
        let json = Data("""
        {
            "id": "codingKeysIp",
            "deviceIp": "10.0.0.1"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.deviceIp, "10.0.0.1")
    }
}
