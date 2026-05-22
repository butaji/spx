import XCTest
@testable import SPX

final class CastMessageTests: XCTestCase {

    // MARK: - Manual Protobuf Encoding

    func testMarshalProtocolVersion() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "source"
        msg.destinationId = "dest"
        msg.namespace = "ns"
        msg.payloadType = .string
        msg.payloadUtf8 = ""

        let data = msg.marshal()

        // Field 1: protocol_version = 0 (varint)
        // Tag byte = (1 << 3) | 0 = 0x08
        // Value = 0 (single byte varint)
        XCTAssertEqual(data[0], 0x08) // tag for field 1
        XCTAssertEqual(data[1], 0x00) // value 0
    }

    func testMarshalKnownBytes() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "src"
        msg.destinationId = "dst"
        msg.namespace = "urn:xcast:conn-schema"
        msg.payloadType = .string
        msg.payloadUtf8 = "hello"

        let data = msg.marshal()

        // Verify wire format structure
        // Field 1 (protocol_version): tag 0x08, value 0x00
        XCTAssertEqual(data[0], 0x08)
        XCTAssertEqual(data[1], 0x00)

        // Field 2 (source_id): tag 0x12, length 3, "src"
        // Tag = (2 << 3) | 2 = 0x12
        XCTAssertEqual(data[2], 0x12)
        XCTAssertEqual(data[3], 0x03) // length
        let sourceId = String(data: data.subdata(in: 4..<7), encoding: .utf8)
        XCTAssertEqual(sourceId, "src")
    }

    func testMarshalWithBinaryPayload() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "sender"
        msg.destinationId = "receiver"
        msg.namespace = "binary_ns"
        msg.payloadType = .binary
        msg.payloadBinary = Data([0xDE, 0xAD, 0xBE, 0xEF])

        let data = msg.marshal()

        // Verify binary payload is present
        XCTAssertTrue(data.count > 0)

        // Verify round-trip: unmarshal and check payload is preserved
        let decoded = CastMessage.unmarshal(data)
        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadType, .binary)
        XCTAssertEqual(decoded?.payloadBinary, Data([0xDE, 0xAD, 0xBE, 0xEF]))
    }

    // MARK: - Manual Protobuf Decoding

    func testUnmarshalKnownBytes() {
        // Manually construct known protobuf bytes
        var data = Data()

        // Field 1: protocol_version = 0
        data.append(0x08) // tag
        data.append(0x00) // value

        // Field 2: source_id = "src"
        data.append(0x12) // tag
        data.append(0x03) // length
        data.append(contentsOf: "src".utf8)

        // Field 3: destination_id = "dst"
        data.append(0x1A) // tag (3 << 3 | 2 = 0x1A)
        data.append(0x03) // length
        data.append(contentsOf: "dst".utf8)

        // Field 4: namespace = "ns"
        data.append(0x22) // tag (4 << 3 | 2 = 0x22)
        data.append(0x02) // length
        data.append(contentsOf: "ns".utf8)

        // Field 5: payload_type = 0
        data.append(0x28) // tag (5 << 3 | 0 = 0x28)
        data.append(0x00) // value

        let msg = CastMessage.unmarshal(data)

        XCTAssertNotNil(msg)
        XCTAssertEqual(msg?.protocolVersion, .castV210)
        XCTAssertEqual(msg?.sourceId, "src")
        XCTAssertEqual(msg?.destinationId, "dst")
        XCTAssertEqual(msg?.namespace, "ns")
        XCTAssertEqual(msg?.payloadType, .string)
    }

    func testUnmarshalWithPayloadUtf8() {
        var data = Data()

        // Field 1: protocol_version = 0
        data.append(contentsOf: [0x08, 0x00])

        // Field 2: source_id = "sender"
        data.append(0x12)
        data.append(0x06)
        data.append(contentsOf: "sender".utf8)

        // Field 3: destination_id = "receiver"
        data.append(0x1A)
        data.append(0x08)
        data.append(contentsOf: "receiver".utf8)

        // Field 4: namespace = "ns"
        data.append(0x22)
        data.append(0x02)
        data.append(contentsOf: "ns".utf8)

        // Field 5: payload_type = 0 (string)
        data.append(contentsOf: [0x28, 0x00])

        // Field 6: payload_utf8 = "test message"
        let payload = "test message"
        data.append(0x32) // tag (6 << 3 | 2)
        data.append(UInt8(payload.count))
        data.append(contentsOf: payload.utf8)

        let msg = CastMessage.unmarshal(data)

        XCTAssertNotNil(msg)
        XCTAssertEqual(msg?.payloadUtf8, "test message")
        XCTAssertEqual(msg?.payloadType, .string)
    }

    func testUnmarshalWithBinaryPayload() {
        var data = Data()

        // Minimal message with binary payload
        data.append(contentsOf: [0x08, 0x00]) // protocol_version
        data.append(0x12)
        data.append(0x01)
        data.append(contentsOf: "s".utf8) // source_id
        data.append(0x1A)
        data.append(0x01)
        data.append(contentsOf: "d".utf8) // destination_id
        data.append(0x22)
        data.append(0x01)
        data.append(contentsOf: "n".utf8) // namespace
        data.append(contentsOf: [0x28, 0x01]) // payload_type = 1 (binary)

        // Field 7: payload_binary = 0xDEADBEEF
        data.append(0x3A) // tag (7 << 3 | 2)
        data.append(0x04) // length 4
        data.append(contentsOf: [0xDE, 0xAD, 0xBE, 0xEF])

        let msg = CastMessage.unmarshal(data)

        XCTAssertNotNil(msg)
        XCTAssertEqual(msg?.payloadType, .binary)
        XCTAssertEqual(msg?.payloadBinary, Data([0xDE, 0xAD, 0xBE, 0xEF]))
    }

    func testUnmarshalEmptyString() {
        var data = Data()

        data.append(contentsOf: [0x08, 0x00]) // protocol_version
        data.append(0x12)
        data.append(0x00) // empty source_id
        data.append(0x1A)
        data.append(0x00) // empty destination_id
        data.append(0x22)
        data.append(0x00) // empty namespace
        data.append(contentsOf: [0x28, 0x00]) // payload_type
        data.append(0x32)
        data.append(0x00) // empty payload_utf8

        let msg = CastMessage.unmarshal(data)

        XCTAssertNotNil(msg)
        XCTAssertEqual(msg?.sourceId, "")
        XCTAssertEqual(msg?.destinationId, "")
        XCTAssertEqual(msg?.namespace, "")
    }

    // MARK: - Round-Trip

    func testRoundTripStringMessage() {
        let original = CastMessage.textMessage(
            sourceId: "sender123",
            destinationId: "receiver456",
            namespace: "urn:xcast:com.google.cast.receiver",
            json: "{\"type\":\"READY\"}"
        )

        let encoded = original.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.sourceId, original.sourceId)
        XCTAssertEqual(decoded?.destinationId, original.destinationId)
        XCTAssertEqual(decoded?.namespace, original.namespace)
        XCTAssertEqual(decoded?.payloadType, original.payloadType)
        XCTAssertEqual(decoded?.payloadUtf8, original.payloadUtf8)
    }

    func testRoundTripBinaryMessage() {
        let binaryData = Data(repeating: 0xAB, count: 256)

        let original = CastMessage.binaryMessage(
            sourceId: "binSender",
            destinationId: "binReceiver",
            namespace: "binary_ns",
            data: binaryData
        )

        let encoded = original.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadType, .binary)
        XCTAssertEqual(decoded?.payloadBinary, binaryData)
    }

    // MARK: - Edge Cases

    func testEmptyStrings() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = ""
        msg.destinationId = ""
        msg.namespace = ""
        msg.payloadType = .string
        msg.payloadUtf8 = ""

        let encoded = msg.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.sourceId, "")
        XCTAssertEqual(decoded?.destinationId, "")
        XCTAssertEqual(decoded?.namespace, "")
    }

    func testLongPayload() {
        let longString = String(repeating: "A", count: 10000)

        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "source"
        msg.destinationId = "dest"
        msg.namespace = "ns"
        msg.payloadType = .string
        msg.payloadUtf8 = longString

        let encoded = msg.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadUtf8?.count, 10000)
        XCTAssertEqual(decoded?.payloadUtf8, longString)
    }

    func testBinaryPayloadType() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "sender"
        msg.destinationId = "receiver"
        msg.namespace = "ns"
        msg.payloadType = .binary
        msg.payloadBinary = Data([0x00, 0xFF, 0x42, 0x13, 0x99])

        let encoded = msg.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadType, .binary)
        XCTAssertEqual(decoded?.payloadBinary, Data([0x00, 0xFF, 0x42, 0x13, 0x99]))
    }

    func testMaxVarintValue() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "s"
        msg.destinationId = "d"
        msg.namespace = "n"
        msg.payloadType = .string

        let encoded = msg.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.protocolVersion, .castV210)
    }
}
