import XCTest
@testable import SPX

// MARK: - SpotifyDeviceEqualityTests

final class SpotifyDeviceEqualityTests: XCTestCase {

    // MARK: - Equality Tests

    func testSpotifyDeviceEquality() throws {
        let json1 = Data("""
        {
            "id": "equalDevice",
            "name": "Equal Device",
            "volume_percent": 75,
            "type": "Computer",
            "is_active": true
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "equalDevice",
            "name": "Equal Device",
            "volume_percent": 75,
            "type": "Computer",
            "is_active": true
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(SpotifyDevice.self, from: json1)
        let device2 = try decoder.decode(SpotifyDevice.self, from: json2)

        XCTAssertEqual(device1, device2)
    }

    func testSpotifyDeviceInequality() throws {
        let json1 = Data("""
        {
            "id": "deviceA",
            "name": "Device A"
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "deviceB",
            "name": "Device B"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(SpotifyDevice.self, from: json1)
        let device2 = try decoder.decode(SpotifyDevice.self, from: json2)

        XCTAssertNotEqual(device1, device2)
    }

    // MARK: - Hashable Tests

    func testSpotifyDeviceHashable() throws {
        let json1 = Data("""
        {
            "id": "hashDevice",
            "name": "Hash Device",
            "volume_percent": 50
        }
        """.utf8)

        let json2 = Data("""
        {
            "id": "hashDevice",
            "name": "Hash Device",
            "volume_percent": 50
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device1 = try decoder.decode(SpotifyDevice.self, from: json1)
        let device2 = try decoder.decode(SpotifyDevice.self, from: json2)

        var hashSet = Set<SpotifyDevice>()
        hashSet.insert(device1)
        hashSet.insert(device2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testSpotifyDeviceHashableInDictionary() throws {
        let json = Data("""
        {
            "id": "dictDevice",
            "name": "Dictionary Device"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        var dict = [SpotifyDevice: String]()
        dict[device] = "testValue"

        XCTAssertEqual(dict[device], "testValue")
    }

    // MARK: - Identifiable Tests

    func testSpotifyDeviceIdentifiable() throws {
        let json = Data("""
        {
            "id": "identifiableDevice"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let device = try decoder.decode(SpotifyDevice.self, from: json)

        XCTAssertEqual(device.id, "identifiableDevice")
    }
}
