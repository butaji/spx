import XCTest
@testable import SPX

// MARK: - SpotifyDeviceDecodingTests

final class SpotifyDeviceDecodingTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullSpotifyDevice() throws {
        let json = Data("""
        {
            "id": "device123",
            "name": "MacBook Pro",
            "volume_percent": 75,
            "type": "Computer",
            "is_active": true,
            "is_private_session": false,
            "is_restricted": false,
            "supports_volume": true,
            "isLocal": false,
            "localNote": "Playing on local device",
            "canTransfer": true,
            "needsWakeUp": false,
            "deviceIp": "192.168.1.100"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "device123")
        XCTAssertEqual(device.name, "MacBook Pro")
        XCTAssertEqual(device.volumePercent, 75)
        XCTAssertEqual(device.type, "Computer")
        XCTAssertEqual(device.isActive, true)
        XCTAssertEqual(device.isPrivateSession, false)
        XCTAssertEqual(device.isRestricted, false)
        XCTAssertEqual(device.supportsVolume, true)
        XCTAssertEqual(device.isLocal, false)
        XCTAssertEqual(device.localNote, "Playing on local device")
        XCTAssertEqual(device.canTransfer, true)
        XCTAssertEqual(device.needsWakeUp, false)
        XCTAssertEqual(device.deviceIp, "192.168.1.100")
    }

    func testDecodingSpotifyDeviceWithAllFields() throws {
        let json = Data("""
        {
            "id": "fullDevice",
            "name": "iPhone 15",
            "volume_percent": 100,
            "type": "Smartphone",
            "is_active": false,
            "is_private_session": true,
            "is_restricted": true,
            "supports_volume": true,
            "isLocal": false,
            "localNote": "Connected via Bluetooth",
            "canTransfer": false,
            "needsWakeUp": true,
            "deviceIp": "10.0.0.50"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "fullDevice")
        XCTAssertEqual(device.name, "iPhone 15")
        XCTAssertEqual(device.volumePercent, 100)
        XCTAssertEqual(device.type, "Smartphone")
        XCTAssertEqual(device.isActive, false)
        XCTAssertEqual(device.isPrivateSession, true)
        XCTAssertEqual(device.isRestricted, true)
        XCTAssertEqual(device.supportsVolume, true)
        XCTAssertEqual(device.isLocal, false)
        XCTAssertEqual(device.localNote, "Connected via Bluetooth")
        XCTAssertEqual(device.canTransfer, false)
        XCTAssertEqual(device.needsWakeUp, true)
        XCTAssertEqual(device.deviceIp, "10.0.0.50")
    }

    // MARK: - Minimal JSON Decoding Tests

    func testDecodingMinimalSpotifyDevice() throws {
        let json = Data("""
        {
            "id": "minimalDevice"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "minimalDevice")
        XCTAssertNil(device.name)
        XCTAssertNil(device.volumePercent)
        XCTAssertNil(device.type)
        XCTAssertNil(device.isActive)
        XCTAssertNil(device.isPrivateSession)
        XCTAssertNil(device.isRestricted)
        XCTAssertNil(device.supportsVolume)
        XCTAssertNil(device.isLocal)
        XCTAssertNil(device.localNote)
        XCTAssertNil(device.canTransfer)
        XCTAssertNil(device.needsWakeUp)
        XCTAssertNil(device.deviceIp)
    }

    func testDecodingSpotifyDeviceWithOnlyId() throws {
        let json = Data("""
        {
            "id": "onlyId"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "onlyId")
    }

    // MARK: - Null Handling Tests

    func testDecodingSpotifyDeviceWithNullOptionals() throws {
        let json = Data("""
        {
            "id": "nullDevice",
            "name": null,
            "volume_percent": null,
            "type": null,
            "is_active": null,
            "is_private_session": null,
            "is_restricted": null,
            "supports_volume": null,
            "isLocal": null,
            "localNote": null,
            "canTransfer": null,
            "needsWakeUp": null,
            "deviceIp": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "nullDevice")
        XCTAssertNil(device.name)
        XCTAssertNil(device.volumePercent)
        XCTAssertNil(device.type)
        XCTAssertNil(device.isActive)
        XCTAssertNil(device.isPrivateSession)
        XCTAssertNil(device.isRestricted)
        XCTAssertNil(device.supportsVolume)
        XCTAssertNil(device.isLocal)
        XCTAssertNil(device.localNote)
        XCTAssertNil(device.canTransfer)
        XCTAssertNil(device.needsWakeUp)
        XCTAssertNil(device.deviceIp)
    }
}
