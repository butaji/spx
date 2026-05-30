import XCTest
@testable import SPX

final class LocalDeviceTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullLocalDevice() throws {
        let json = Data("""
        {
            "name": "MacBook Pro",
            "ip": "192.168.1.100",
            "port": 8080,
            "id": "device123",
            "is_active": true,
            "canTransfer": true,
            "note": "This is a test device",
            "service_type": "video",
            "friendly_name": "My MacBook"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.name, "MacBook Pro")
        XCTAssertEqual(device.ipAddress, "192.168.1.100")
        XCTAssertEqual(device.port, 8080)
        XCTAssertEqual(device.id, "device123")
        XCTAssertEqual(device.isActive, true)
        XCTAssertEqual(device.canTransfer, true)
        XCTAssertEqual(device.note, "This is a test device")
        XCTAssertEqual(device.serviceType, "video")
        XCTAssertEqual(device.friendlyName, "My MacBook")
    }

    func testDecodingLocalDeviceWithAllFields() throws {
        let json = Data("""
        {
            "name": "Test Device",
            "ip": "10.0.0.1",
            "port": 3000,
            "id": "fullDevice",
            "is_active": false,
            "canTransfer": false,
            "note": "Note here",
            "service_type": "audio",
            "friendly_name": "Friendly Device"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.name, "Test Device")
        XCTAssertEqual(device.ipAddress, "10.0.0.1")
        XCTAssertEqual(device.port, 3000)
        XCTAssertEqual(device.id, "fullDevice")
        XCTAssertEqual(device.isActive, false)
        XCTAssertEqual(device.canTransfer, false)
        XCTAssertEqual(device.note, "Note here")
        XCTAssertEqual(device.serviceType, "audio")
        XCTAssertEqual(device.friendlyName, "Friendly Device")
    }

    // MARK: - Minimal JSON Decoding Tests

    func testDecodingMinimalLocalDevice() throws {
        let json = Data("""
        {
            "name": "Minimal Device",
            "ip": "127.0.0.1",
            "port": 80
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.name, "Minimal Device")
        XCTAssertEqual(device.ipAddress, "127.0.0.1")
        XCTAssertEqual(device.port, 80)
        XCTAssertNil(device.id)
        XCTAssertNil(device.isActive)
        XCTAssertNil(device.canTransfer)
        XCTAssertNil(device.note)
        XCTAssertNil(device.serviceType)
        XCTAssertNil(device.friendlyName)
    }

    func testDecodingLocalDeviceWithOnlyRequiredFields() throws {
        let json = Data("""
        {
            "name": "Required Only",
            "ip": "0.0.0.0",
            "port": 443
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.name, "Required Only")
        XCTAssertEqual(device.ipAddress, "0.0.0.0")
        XCTAssertEqual(device.port, 443)
    }

    // MARK: - Null Handling Tests

    func testDecodingLocalDeviceWithNullOptionals() throws {
        let json = Data("""
        {
            "name": "Null Device",
            "ip": "192.168.0.1",
            "port": 9000,
            "id": null,
            "is_active": null,
            "canTransfer": null,
            "note": null,
            "service_type": null,
            "friendly_name": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.name, "Null Device")
        XCTAssertEqual(device.ipAddress, "192.168.0.1")
        XCTAssertEqual(device.port, 9000)
        XCTAssertNil(device.id)
        XCTAssertNil(device.isActive)
        XCTAssertNil(device.canTransfer)
        XCTAssertNil(device.note)
        XCTAssertNil(device.serviceType)
        XCTAssertNil(device.friendlyName)
    }

    func testDecodingLocalDeviceWithNullIpAddress() throws {
        let json = Data("""
        {
            "name": "Null IP Device",
            "ip": null,
            "port": 8080
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.name, "Null IP Device")
        XCTAssertNil(device.ipAddress)
        XCTAssertEqual(device.port, 8080)
    }

    // MARK: - CodingKeys Tests

    func testLocalDeviceCodingKeysIpField() throws {
        let json = Data("""
        {
            "name": "Coding Keys Test",
            "ip": "172.16.0.1",
            "port": 8888
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.ipAddress, "172.16.0.1")
    }

    func testLocalDeviceCodingKeysIsActiveField() throws {
        let json = Data("""
        {
            "name": "Active Test",
            "ip": "10.0.0.1",
            "port": 8080,
            "is_active": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.isActive, true)
    }

    func testLocalDeviceCodingKeysServiceTypeField() throws {
        let json = Data("""
        {
            "name": "Service Type Test",
            "ip": "10.0.0.2",
            "port": 9090,
            "service_type": "music"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.serviceType, "music")
    }

    func testLocalDeviceCodingKeysFriendlyNameField() throws {
        let json = Data("""
        {
            "name": "Friendly Name Test",
            "ip": "10.0.0.3",
            "port": 7777,
            "friendly_name": "My Cool Device"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.friendlyName, "My Cool Device")
    }

    // MARK: - Equality Tests

    func testLocalDeviceEquality() throws {
        let json1 = Data("""
        {
            "name": "Equal Device",
            "ip": "192.168.1.1",
            "port": 8080,
            "id": "device1",
            "is_active": true,
            "canTransfer": true,
            "note": "Note",
            "service_type": "audio",
            "friendly_name": "Device One"
        }
        """.utf8)

        let json2 = Data("""
        {
            "name": "Equal Device",
            "ip": "192.168.1.1",
            "port": 8080,
            "id": "device1",
            "is_active": true,
            "canTransfer": true,
            "note": "Note",
            "service_type": "audio",
            "friendly_name": "Device One"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(LocalDevice.self, from: json1)
        let device2 = try decoder.decode(LocalDevice.self, from: json2)

        XCTAssertEqual(device1, device2)
    }

    func testLocalDeviceInequality() throws {
        let json1 = Data("""
        {
            "name": "Device A",
            "ip": "10.0.0.1",
            "port": 8080
        }
        """.utf8)

        let json2 = Data("""
        {
            "name": "Device B",
            "ip": "10.0.0.2",
            "port": 9090
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(LocalDevice.self, from: json1)
        let device2 = try decoder.decode(LocalDevice.self, from: json2)

        XCTAssertNotEqual(device1, device2)
    }

    func testLocalDeviceInequalityById() throws {
        let json1 = Data("""
        {
            "name": "Same Name",
            "ip": "10.0.0.1",
            "port": 8080,
            "id": "id1"
        }
        """.utf8)

        let json2 = Data("""
        {
            "name": "Same Name",
            "ip": "10.0.0.1",
            "port": 8080,
            "id": "id2"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(LocalDevice.self, from: json1)
        let device2 = try decoder.decode(LocalDevice.self, from: json2)

        XCTAssertNotEqual(device1, device2)
    }

    // MARK: - Hashable Tests

    func testLocalDeviceHashable() throws {
        let json1 = Data("""
        {
            "name": "Hash Device",
            "ip": "192.168.1.100",
            "port": 8080,
            "id": "hashId"
        }
        """.utf8)

        let json2 = Data("""
        {
            "name": "Hash Device",
            "ip": "192.168.1.100",
            "port": 8080,
            "id": "hashId"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(LocalDevice.self, from: json1)
        let device2 = try decoder.decode(LocalDevice.self, from: json2)

        var hashSet = Set<LocalDevice>()
        hashSet.insert(device1)
        hashSet.insert(device2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testLocalDeviceHashableDifferentIds() throws {
        let json1 = Data("""
        {
            "name": "Same Device",
            "ip": "10.0.0.1",
            "port": 8080,
            "id": "unique1"
        }
        """.utf8)

        let json2 = Data("""
        {
            "name": "Same Device",
            "ip": "10.0.0.1",
            "port": 8080,
            "id": "unique2"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(LocalDevice.self, from: json1)
        let device2 = try decoder.decode(LocalDevice.self, from: json2)

        var hashSet = Set<LocalDevice>()
        hashSet.insert(device1)
        hashSet.insert(device2)

        XCTAssertEqual(hashSet.count, 2)
    }

    func testLocalDeviceHashableInDictionary() throws {
        let json = Data("""
        {
            "name": "Dict Device",
            "ip": "10.0.0.5",
            "port": 6000
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        var dict = [LocalDevice: String]()
        dict[device] = "test"

        XCTAssertEqual(dict[device], "test")
    }

    // MARK: - Field Variation Tests

    func testLocalDeviceWithDifferentPortValues() throws {
        let ports = [0, 1, 80, 443, 8080, 65535]

        for port in ports {
            let json = Data("""
            {
                "name": "Port Test",
                "ip": "127.0.0.1",
                "port": \(port)
            }
            """.utf8)

            let decoder = JSONDecoder()
            let device = try decoder.decode(LocalDevice.self, from: json)
            XCTAssertEqual(device.port, port)
        }
    }

    func testLocalDeviceWithVariousServiceTypes() throws {
        let serviceTypes = ["audio", "video", "music", "podcast", "unknown"]

        for serviceType in serviceTypes {
            let json = Data("""
            {
                "name": "Service Test",
                "ip": "10.0.0.1",
                "port": 8080,
                "service_type": "\(serviceType)"
            }
            """.utf8)

            let decoder = JSONDecoder()
            let device = try decoder.decode(LocalDevice.self, from: json)
            XCTAssertEqual(device.serviceType, serviceType)
        }
    }

    func testLocalDeviceWithVariousBooleanFields() throws {
        let json = Data("""
        {
            "name": "Bool Test",
            "ip": "10.0.0.1",
            "port": 8080,
            "is_active": true,
            "canTransfer": false
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(LocalDevice.self, from: json)

        XCTAssertEqual(device.isActive, true)
        XCTAssertEqual(device.canTransfer, false)
    }
}
