import XCTest
@testable import SPX

// MARK: - SpotifyDeviceFieldTests

final class SpotifyDeviceFieldTests: XCTestCase {

    // MARK: - Device Type Tests

    func testDecodingSpotifyDeviceComputer() throws {
        let json = Data("""
        {
            "id": "computer",
            "name": "MacBook Air",
            "type": "Computer"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "Computer")
    }

    func testDecodingSpotifyDeviceSmartphone() throws {
        let json = Data("""
        {
            "id": "phone",
            "name": "iPhone 14",
            "type": "Smartphone"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "Smartphone")
    }

    func testDecodingSpotifyDeviceSpeaker() throws {
        let json = Data("""
        {
            "id": "speaker",
            "name": "Sonos One",
            "type": "Speaker"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "Speaker")
    }

    func testDecodingSpotifyDeviceTV() throws {
        let json = Data("""
        {
            "id": "tv",
            "name": "Samsung TV",
            "type": "TV"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "TV")
    }

    // MARK: - Volume Percent Tests

    func testDecodingSpotifyDeviceVolumeZero() throws {
        let json = Data("""
        {
            "id": "mute",
            "name": "Muted Device",
            "volume_percent": 0
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 0)
    }

    func testDecodingSpotifyDeviceVolumeMax() throws {
        let json = Data("""
        {
            "id": "maxVolume",
            "name": "Max Volume",
            "volume_percent": 100
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 100)
    }

    func testDecodingSpotifyDeviceVolumeHalf() throws {
        let json = Data("""
        {
            "id": "halfVolume",
            "name": "Half Volume",
            "volume_percent": 50
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 50)
    }

    // MARK: - Boolean Field Tests

    func testDecodingSpotifyDeviceIsActiveTrue() throws {
        let json = Data("""
        {
            "id": "active",
            "is_active": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isActive, true)
    }

    func testDecodingSpotifyDeviceIsActiveFalse() throws {
        let json = Data("""
        {
            "id": "inactive",
            "is_active": false
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isActive, false)
    }

    func testDecodingSpotifyDevicePrivateSession() throws {
        let json = Data("""
        {
            "id": "private",
            "is_private_session": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isPrivateSession, true)
    }

    func testDecodingSpotifyDeviceRestricted() throws {
        let json = Data("""
        {
            "id": "restricted",
            "is_restricted": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isRestricted, true)
    }

    func testDecodingSpotifyDeviceSupportsVolume() throws {
        let json = Data("""
        {
            "id": "volumeSupport",
            "supports_volume": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.supportsVolume, true)
    }

    func testDecodingSpotifyDeviceIsLocal() throws {
        let json = Data("""
        {
            "id": "local",
            "isLocal": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isLocal, true)
    }

    func testDecodingSpotifyDeviceCanTransfer() throws {
        let json = Data("""
        {
            "id": "transfer",
            "canTransfer": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.canTransfer, true)
    }

    func testDecodingSpotifyDeviceNeedsWakeUp() throws {
        let json = Data("""
        {
            "id": "wakeup",
            "needsWakeUp": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.needsWakeUp, true)
    }

    // MARK: - Local Note Tests

    func testDecodingSpotifyDeviceWithLocalNote() throws {
        let json = Data("""
        {
            "id": "noteDevice",
            "localNote": "This is a local-only note"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.localNote, "This is a local-only note")
    }

    func testDecodingSpotifyDeviceWithEmptyLocalNote() throws {
        let json = Data("""
        {
            "id": "emptyNote",
            "localNote": ""
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.localNote, "")
    }

    // MARK: - Device IP Tests

    func testDecodingSpotifyDeviceWithDeviceIp() throws {
        let json = Data("""
        {
            "id": "ipDevice",
            "deviceIp": "192.168.0.1"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.deviceIp, "192.168.0.1")
    }
}
