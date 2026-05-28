import XCTest
@testable import SPX

final class SpotifyDeviceTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullSpotifyDevice() throws {
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
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
        """.data(using: .utf8)!

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
        let json = """
        {
            "id": "minimalDevice"
        }
        """.data(using: .utf8)!

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
        let json = """
        {
            "id": "onlyId"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "onlyId")
    }

    // MARK: - Null Handling Tests

    func testDecodingSpotifyDeviceWithNullOptionals() throws {
        let json = """
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
        """.data(using: .utf8)!

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

    // MARK: - Device Type Tests

    func testDecodingSpotifyDeviceComputer() throws {
        let json = """
        {
            "id": "computer",
            "name": "MacBook Air",
            "type": "Computer"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "Computer")
    }

    func testDecodingSpotifyDeviceSmartphone() throws {
        let json = """
        {
            "id": "phone",
            "name": "iPhone 14",
            "type": "Smartphone"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "Smartphone")
    }

    func testDecodingSpotifyDeviceSpeaker() throws {
        let json = """
        {
            "id": "speaker",
            "name": "Sonos One",
            "type": "Speaker"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "Speaker")
    }

    func testDecodingSpotifyDeviceTV() throws {
        let json = """
        {
            "id": "tv",
            "name": "Samsung TV",
            "type": "TV"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.type, "TV")
    }

    // MARK: - Volume Percent Tests

    func testDecodingSpotifyDeviceVolumeZero() throws {
        let json = """
        {
            "id": "mute",
            "name": "Muted Device",
            "volume_percent": 0
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 0)
    }

    func testDecodingSpotifyDeviceVolumeMax() throws {
        let json = """
        {
            "id": "maxVolume",
            "name": "Max Volume",
            "volume_percent": 100
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 100)
    }

    func testDecodingSpotifyDeviceVolumeHalf() throws {
        let json = """
        {
            "id": "halfVolume",
            "name": "Half Volume",
            "volume_percent": 50
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 50)
    }

    // MARK: - Boolean Field Tests

    func testDecodingSpotifyDeviceIsActiveTrue() throws {
        let json = """
        {
            "id": "active",
            "is_active": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isActive, true)
    }

    func testDecodingSpotifyDeviceIsActiveFalse() throws {
        let json = """
        {
            "id": "inactive",
            "is_active": false
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isActive, false)
    }

    func testDecodingSpotifyDevicePrivateSession() throws {
        let json = """
        {
            "id": "private",
            "is_private_session": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isPrivateSession, true)
    }

    func testDecodingSpotifyDeviceRestricted() throws {
        let json = """
        {
            "id": "restricted",
            "is_restricted": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isRestricted, true)
    }

    func testDecodingSpotifyDeviceSupportsVolume() throws {
        let json = """
        {
            "id": "volumeSupport",
            "supports_volume": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.supportsVolume, true)
    }

    func testDecodingSpotifyDeviceIsLocal() throws {
        let json = """
        {
            "id": "local",
            "isLocal": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isLocal, true)
    }

    func testDecodingSpotifyDeviceCanTransfer() throws {
        let json = """
        {
            "id": "transfer",
            "canTransfer": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.canTransfer, true)
    }

    func testDecodingSpotifyDeviceNeedsWakeUp() throws {
        let json = """
        {
            "id": "wakeup",
            "needsWakeUp": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.needsWakeUp, true)
    }

    // MARK: - Local Note Tests

    func testDecodingSpotifyDeviceWithLocalNote() throws {
        let json = """
        {
            "id": "noteDevice",
            "localNote": "This is a local-only note"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.localNote, "This is a local-only note")
    }

    func testDecodingSpotifyDeviceWithEmptyLocalNote() throws {
        let json = """
        {
            "id": "emptyNote",
            "localNote": ""
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.localNote, "")
    }

    // MARK: - Device IP Tests

    func testDecodingSpotifyDeviceWithDeviceIp() throws {
        let json = """
        {
            "id": "ipDevice",
            "deviceIp": "192.168.0.1"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.deviceIp, "192.168.0.1")
    }

    // MARK: - CodingKeys Tests

    func testSpotifyDeviceCodingKeysVolumePercent() throws {
        let json = """
        {
            "id": "codingKeysVol",
            "volume_percent": 80
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.volumePercent, 80)
    }

    func testSpotifyDeviceCodingKeysIsActive() throws {
        let json = """
        {
            "id": "codingKeysActive",
            "is_active": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isActive, true)
    }

    func testSpotifyDeviceCodingKeysIsPrivateSession() throws {
        let json = """
        {
            "id": "codingKeysPrivate",
            "is_private_session": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isPrivateSession, true)
    }

    func testSpotifyDeviceCodingKeysIsRestricted() throws {
        let json = """
        {
            "id": "codingKeysRestricted",
            "is_restricted": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isRestricted, true)
    }

    func testSpotifyDeviceCodingKeysSupportsVolume() throws {
        let json = """
        {
            "id": "codingKeysVolSupport",
            "supports_volume": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.supportsVolume, true)
    }

    func testSpotifyDeviceCodingKeysIsLocal() throws {
        let json = """
        {
            "id": "codingKeysLocal",
            "isLocal": false
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.isLocal, false)
    }

    func testSpotifyDeviceCodingKeysLocalNote() throws {
        let json = """
        {
            "id": "codingKeysNote",
            "localNote": "Test note"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.localNote, "Test note")
    }

    func testSpotifyDeviceCodingKeysCanTransfer() throws {
        let json = """
        {
            "id": "codingKeysTransfer",
            "canTransfer": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.canTransfer, true)
    }

    func testSpotifyDeviceCodingKeysNeedsWakeUp() throws {
        let json = """
        {
            "id": "codingKeysWakeUp",
            "needsWakeUp": false
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.needsWakeUp, false)
    }

    func testSpotifyDeviceCodingKeysDeviceIp() throws {
        let json = """
        {
            "id": "codingKeysIp",
            "deviceIp": "10.0.0.1"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.deviceIp, "10.0.0.1")
    }

    // MARK: - Equality Tests

    func testSpotifyDeviceEquality() throws {
        let json1 = """
        {
            "id": "equalDevice",
            "name": "Equal Device",
            "volume_percent": 75,
            "type": "Computer",
            "is_active": true
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "equalDevice",
            "name": "Equal Device",
            "volume_percent": 75,
            "type": "Computer",
            "is_active": true
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(SpotifyDevice.self, from: json1)
        let device2 = try decoder.decode(SpotifyDevice.self, from: json2)

        XCTAssertEqual(device1, device2)
    }

    func testSpotifyDeviceInequality() throws {
        let json1 = """
        {
            "id": "deviceA",
            "name": "Device A"
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "deviceB",
            "name": "Device B"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(SpotifyDevice.self, from: json1)
        let device2 = try decoder.decode(SpotifyDevice.self, from: json2)

        XCTAssertNotEqual(device1, device2)
    }

    // MARK: - Hashable Tests

    func testSpotifyDeviceHashable() throws {
        let json1 = """
        {
            "id": "hashDevice",
            "name": "Hash Device",
            "volume_percent": 50
        }
        """.data(using: .utf8)!

        let json2 = """
        {
            "id": "hashDevice",
            "name": "Hash Device",
            "volume_percent": 50
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(SpotifyDevice.self, from: json1)
        let device2 = try decoder.decode(SpotifyDevice.self, from: json2)

        var hashSet = Set<SpotifyDevice>()
        hashSet.insert(device1)
        hashSet.insert(device2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testSpotifyDeviceHashableInDictionary() throws {
        let json = """
        {
            "id": "dictDevice",
            "name": "Dictionary Device"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        var dict = [SpotifyDevice: String]()
        dict[device] = "testValue"

        XCTAssertEqual(dict[device], "testValue")
    }

    // MARK: - Identifiable Tests

    func testSpotifyDeviceIdentifiable() throws {
        let json = """
        {
            "id": "identifiableDevice"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "identifiableDevice")
    }
}
