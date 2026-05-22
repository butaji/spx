import XCTest
@testable import SPX

/// Detailed protobuf wire format tests for CastMessage.
/// These tests verify byte-level correctness of varint encoding,
/// length-delimited encoding, and complete message serialization.
final class CastMessageProtobufTests: XCTestCase {

    // MARK: - Varint Encoding

    func testVarintEncodeZero() {
        let data = CastMessage.encodeVarint(0)
        XCTAssertEqual(data.count, 1)
        XCTAssertEqual(data[0], 0x00)
    }

    func testVarintEncodeOne() {
        let data = CastMessage.encodeVarint(1)
        XCTAssertEqual(data.count, 1)
        XCTAssertEqual(data[0], 0x01)
    }

    func testVarintEncode127() {
        // 127 = 0x7F, fits in single byte without continuation bit
        let data = CastMessage.encodeVarint(127)
        XCTAssertEqual(data.count, 1)
        XCTAssertEqual(data[0], 0x7F)
    }

    func testVarintEncode128() {
        // 128 = 0x80, requires continuation bit
        // Low 7 bits: 0x00, continuation: 0x80
        let data = CastMessage.encodeVarint(128)
        XCTAssertEqual(data.count, 2)
        XCTAssertEqual(data[0], 0x80) // continuation bit set
        XCTAssertEqual(data[1], 0x01) // value = 1
    }

    func testVarintEncode300() {
        // 300 = 0x12C
        // Low 7 bits: 0x2C = 44, continuation: 0x80
        // High bits: 0x02 = 2
        let data = CastMessage.encodeVarint(300)
        XCTAssertEqual(data.count, 2)
        XCTAssertEqual(data[0], 0xAC) // 0x80 | 44 = 0xAC
        XCTAssertEqual(data[1], 0x02) // value / 128 = 2
    }

    func testVarintEncodeMaxInt32() {
        // Test with max varint (theoretical, but protobuf uses 10 bytes max for 64-bit)
        let data = CastMessage.encodeVarint(Int32.max)
        XCTAssertTrue(data.count > 1)
        // Just verify it doesn't crash and has valid continuation bit pattern
        XCTAssertEqual(data[data.count - 1] & 0x80, 0)
    }

    // MARK: - Varint Decoding

    func testVarintDecodeZero() {
        let data = Data([0x00])
        let (value, consumed) = CastMessage.decodeVarint(data, offset: 0)
        XCTAssertEqual(value, 0)
        XCTAssertEqual(consumed, 1)
    }

    func testVarintDecode127() {
        let data = Data([0x7F])
        let (value, consumed) = CastMessage.decodeVarint(data, offset: 0)
        XCTAssertEqual(value, 127)
        XCTAssertEqual(consumed, 1)
    }

    func testVarintDecode128() {
        // 128 encoded as [0x80, 0x01]
        let data = Data([0x80, 0x01])
        let (value, consumed) = CastMessage.decodeVarint(data, offset: 0)
        XCTAssertEqual(value, 128)
        XCTAssertEqual(consumed, 2)
    }

    func testVarintDecode300() {
        // 300 encoded as [0xAC, 0x02]
        let data = Data([0xAC, 0x02])
        let (value, consumed) = CastMessage.decodeVarint(data, offset: 0)
        XCTAssertEqual(value, 300)
        XCTAssertEqual(consumed, 2)
    }

    func testVarintDecodeLargeValue() {
        // Test decoding larger varints
        // 1000 = 0x3E8 -> encoded as [0xE8, 0x07]
        // 0xE8 = 11101000 (continuation bit set), 0x07 = 00000111 (no continuation)
        let data = Data([0xE8, 0x07])
        let (value, consumed) = CastMessage.decodeVarint(data, offset: 0)
        XCTAssertEqual(value, 1000)
        XCTAssertEqual(consumed, 2)
    }

    // MARK: - String Length-Delimited Encoding

    func testEncodeStringEmpty() {
        let data = CastMessage.encodeString("")
        // Empty string: length varint (0) + no bytes
        XCTAssertEqual(data.count, 1)
        XCTAssertEqual(data[0], 0x00)
    }

    func testEncodeStringShort() {
        let data = CastMessage.encodeString("abc")
        // Length varint (3) + "abc"
        XCTAssertEqual(data.count, 4)
        XCTAssertEqual(data[0], 0x03) // length = 3
        let str = String(data: data.subdata(in: 1..<4), encoding: .utf8)
        XCTAssertEqual(str, "abc")
    }

    func testEncodeStringLong() {
        let longString = String(repeating: "A", count: 255)
        let data = CastMessage.encodeString(longString)
        // Length = 255, varint encoded as 2 bytes: 0xFF, 0x01
        // Total = 2 bytes length + 255 bytes content = 257 bytes
        XCTAssertTrue(data.count == 257)
    }

    // MARK: - Field Tag Encoding

    func testVarintTagField1() {
        // Field 1, wire type 0: (1 << 3) | 0 = 0x08
        XCTAssertEqual(CastMessage.varintTag(field: 1), 0x08)
    }

    func testVarintTagField5() {
        // Field 5, wire type 0: (5 << 3) | 0 = 0x28
        XCTAssertEqual(CastMessage.varintTag(field: 5), 0x28)
    }

    func testLengthDelimitedTagField2() {
        // Field 2, wire type 2: (2 << 3) | 2 = 0x12
        XCTAssertEqual(CastMessage.lengthDelimitedTag(field: 2), 0x12)
    }

    func testLengthDelimitedTagField6() {
        // Field 6, wire type 2: (6 << 3) | 2 = 0x32
        XCTAssertEqual(CastMessage.lengthDelimitedTag(field: 6), 0x32)
    }

    func testLengthDelimitedTagField7() {
        // Field 7, wire type 2: (7 << 3) | 2 = 0x3A
        XCTAssertEqual(CastMessage.lengthDelimitedTag(field: 7), 0x3A)
    }

    // MARK: - Full Message Byte-by-Byte Verification

    func testMarshalFullMessageByteVerification() {
        // Construct a message and verify each byte against manually computed expected values
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "src"
        msg.destinationId = "dst"
        msg.namespace = "ns"
        msg.payloadType = .string
        msg.payloadUtf8 = ""

        let data = msg.marshal()

        // Expected layout:
        // Field 1 (protocol_version): tag 0x08, varint 0x00
        // Field 2 (source_id): tag 0x12, length 3, "src"
        // Field 3 (destination_id): tag 0x1A, length 3, "dst"
        // Field 4 (namespace): tag 0x22, length 2, "ns"
        // Field 5 (payload_type): tag 0x28, varint 0x00
        // Field 6 (payload_utf8): NOT emitted when empty per implementation

        XCTAssertEqual(data[0], 0x08) // tag field 1
        XCTAssertEqual(data[1], 0x00) // protocol_version = 0

        XCTAssertEqual(data[2], 0x12) // tag field 2
        XCTAssertEqual(data[3], 0x03) // length 3
        XCTAssertEqual(data[4], 0x73) // 's'
        XCTAssertEqual(data[5], 0x72) // 'r'
        XCTAssertEqual(data[6], 0x63) // 'c'

        XCTAssertEqual(data[7], 0x1A) // tag field 3
        XCTAssertEqual(data[8], 0x03) // length 3
        XCTAssertEqual(data[9], 0x64) // 'd'
        XCTAssertEqual(data[10], 0x73) // 's'
        XCTAssertEqual(data[11], 0x74) // 't'

        XCTAssertEqual(data[12], 0x22) // tag field 4
        XCTAssertEqual(data[13], 0x02) // length 2
        XCTAssertEqual(data[14], 0x6E) // 'n'
        XCTAssertEqual(data[15], 0x73) // 's'

        XCTAssertEqual(data[16], 0x28) // tag field 5
        XCTAssertEqual(data[17], 0x00) // payload_type = 0
    }

    func testMarshalWithPayloadByteVerification() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "x"
        msg.destinationId = "y"
        msg.namespace = "z"
        msg.payloadType = .string
        msg.payloadUtf8 = "hi"

        let data = msg.marshal()

        // Field 6 (payload_utf8): tag 0x32, length 2, "hi"
        // Find payload field by scanning
        var foundPayload = false
        var i = 0
        while i < data.count - 1 {
            if data[i] == 0x32 { // payload_utf8 tag
                XCTAssertEqual(data[i + 1], 0x02) // length 2
                let payload = String(data: data.subdata(in: (i + 2)..<(i + 4)), encoding: .utf8)
                XCTAssertEqual(payload, "hi")
                foundPayload = true
                break
            }
            i += 1
        }
        XCTAssertTrue(foundPayload)
    }

    // MARK: - Message with Empty Payload

    func testMarshalEmptyPayloadUtf8() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = ""
        msg.destinationId = ""
        msg.namespace = ""
        msg.payloadType = .string
        msg.payloadUtf8 = nil

        let data = msg.marshal()

        // Should only have required fields, no payload_utf8 since it's nil
        XCTAssertTrue(data.count > 0)
        // Should not contain field 6 tag (0x32) since payload is nil
        XCTAssertFalse(data.contains(0x32))
    }

    func testMarshalEmptyStringPayload() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = ""
        msg.destinationId = ""
        msg.namespace = ""
        msg.payloadType = .string
        msg.payloadUtf8 = ""

        let data = msg.marshal()

        // Empty string is also not emitted per implementation
        XCTAssertFalse(data.contains(0x32))
    }

    func testUnmarshalEmptyPayloadField() {
        // Message with explicit empty payload_utf8 field
        var data = Data()
        data.append(contentsOf: [0x08, 0x00]) // protocol_version
        data.append(0x12)
        data.append(0x00) // empty source_id
        data.append(0x1A)
        data.append(0x00) // empty destination_id
        data.append(0x22)
        data.append(0x00) // empty namespace
        data.append(contentsOf: [0x28, 0x00]) // payload_type = 0
        data.append(0x32)
        data.append(0x00) // empty payload_utf8

        let msg = CastMessage.unmarshal(data)

        XCTAssertNotNil(msg)
        XCTAssertEqual(msg?.payloadUtf8, "")
    }

    // MARK: - Message with Unicode Strings

    func testMarshalUnicodeSourceId() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "日本語"
        msg.destinationId = "dest"
        msg.namespace = "ns"
        msg.payloadType = .string
        msg.payloadUtf8 = ""

        let data = msg.marshal()

        // Should successfully marshal unicode string
        XCTAssertTrue(data.count > 0)
        let decoded = CastMessage.unmarshal(data)
        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.sourceId, "日本語")
    }

    func testMarshalUnicodePayload() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "src"
        msg.destinationId = "dest"
        msg.namespace = "ns"
        msg.payloadType = .string
        msg.payloadUtf8 = "{\"message\":\"こんにちは\"}"

        let data = msg.marshal()

        XCTAssertTrue(data.count > 0)
        let decoded = CastMessage.unmarshal(data)
        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadUtf8, "{\"message\":\"こんにちは\"}")
    }

    func testMarshalEmojiPayload() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "src"
        msg.destinationId = "dest"
        msg.namespace = "ns"
        msg.payloadType = .string
        msg.payloadUtf8 = "🎵 Hello 🌍"

        let data = msg.marshal()

        XCTAssertTrue(data.count > 0)
        let decoded = CastMessage.unmarshal(data)
        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadUtf8, "🎵 Hello 🌍")
    }

    func testMarshalMixedUnicode() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "café"
        msg.destinationId = "naïve"
        msg.namespace = "résumé"
        msg.payloadType = .string
        msg.payloadUtf8 = "日本語🎉"

        let data = msg.marshal()

        let decoded = CastMessage.unmarshal(data)
        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.sourceId, "café")
        XCTAssertEqual(decoded?.destinationId, "naïve")
        XCTAssertEqual(decoded?.namespace, "résumé")
        XCTAssertEqual(decoded?.payloadUtf8, "日本語🎉")
    }

    // MARK: - Round-Trip with Wire Format Verification

    func testRoundTripPreservesBytes() {
        let original = CastMessage.textMessage(
            sourceId: "sender",
            destinationId: "receiver",
            namespace: "urn:xcast:conn-schema",
            json: "{\"type\":\"LAUNCH\"}"
        )

        let encoded = original.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.sourceId, original.sourceId)
        XCTAssertEqual(decoded?.destinationId, original.destinationId)
        XCTAssertEqual(decoded?.namespace, original.namespace)
        XCTAssertEqual(decoded?.payloadUtf8, original.payloadUtf8)

        // Verify re-encoding produces identical bytes
        let reEncoded = decoded!.marshal()
        XCTAssertEqual(encoded, reEncoded)
    }

    // MARK: - Binary Payload Wire Format

    func testBinaryPayloadWireFormat() {
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "s"
        msg.destinationId = "d"
        msg.namespace = "n"
        msg.payloadType = .binary
        msg.payloadBinary = Data([0x00, 0xFF, 0x42])

        let data = msg.marshal()

        // Find field 7 (payload_binary) tag 0x3A
        var foundBinary = false
        var i = 0
        while i < data.count {
            if data[i] == 0x3A { // tag for field 7
                XCTAssertEqual(data[i + 1], 0x03) // length 3
                let payloadData = data.subdata(in: (i + 2)..<(i + 5))
                XCTAssertEqual(payloadData, Data([0x00, 0xFF, 0x42]))
                foundBinary = true
                break
            }
            i += 1
        }
        XCTAssertTrue(foundBinary)
    }

    func testBinaryPayloadPreservesAllBytes() {
        // Test that all possible byte values are preserved
        let binaryPayload = Data((0...255).map { UInt8($0) })

        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = "s"
        msg.destinationId = "d"
        msg.namespace = "n"
        msg.payloadType = .binary
        msg.payloadBinary = binaryPayload

        let encoded = msg.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.payloadBinary, binaryPayload)
    }

    // MARK: - Protobuf Edge Cases

    func testMessageWithAllFieldsMaximal() {
        // Message with maximum field values
        var msg = CastMessage()
        msg.protocolVersion = .castV210
        msg.sourceId = String(repeating: "a", count: 128)
        msg.destinationId = String(repeating: "b", count: 128)
        msg.namespace = String(repeating: "c", count: 128)
        msg.payloadType = .binary
        msg.payloadBinary = Data(repeating: 0xAB, count: 128)

        let encoded = msg.marshal()
        let decoded = CastMessage.unmarshal(encoded)

        XCTAssertNotNil(decoded)
        XCTAssertEqual(decoded?.sourceId.count, 128)
        XCTAssertEqual(decoded?.destinationId.count, 128)
        XCTAssertEqual(decoded?.namespace.count, 128)
        XCTAssertEqual(decoded?.payloadBinary?.count, 128)
    }

    func testUnknownFieldSkipped() {
        // Manually construct message with unknown field
        var data = Data()
        data.append(contentsOf: [0x08, 0x00]) // protocol_version
        data.append(0x12)
        data.append(0x03)
        data.append(contentsOf: "src".utf8) // source_id
        data.append(0x1A)
        data.append(0x03)
        data.append(contentsOf: "dst".utf8) // destination_id
        data.append(0x22)
        data.append(0x02)
        data.append(contentsOf: "ns".utf8) // namespace
        data.append(contentsOf: [0x28, 0x00]) // payload_type

        // Unknown field 99, wire type 2 (length-delimited)
        // Field tag = (99 << 3) | 2 = 794 = 0x31A
        // Varint encoding of 794: 0x9A (continuation), 0x06 (no continuation)
        // Length = 1, value = [0x05]
        data.append(contentsOf: [0x9A, 0x06]) // tag for field 99, length-delimited
        data.append(contentsOf: [0x01]) // length = 1
        data.append(contentsOf: [0x05]) // value = 0x05

        let msg = CastMessage.unmarshal(data)

        XCTAssertNotNil(msg)
        XCTAssertEqual(msg?.sourceId, "src")
        XCTAssertEqual(msg?.destinationId, "dst")
        XCTAssertEqual(msg?.namespace, "ns")
    }
}
