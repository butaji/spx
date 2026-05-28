import Foundation

// MARK: - CastMessage Protobuf

/// Manual protobuf encode/decode for CastMessage.
/// Wire format: field_tag + value, where field_tag = (field_number << 3) | wire_type
/// Wire types: 0 = varint, 2 = length-delimited (strings/bytes)
public struct CastMessage: Sendable {
    public enum ProtocolVersion: Int32, Sendable {
        case castV210 = 0
    }

    public enum PayloadType: Int32, Sendable {
        case string = 0
        case binary = 1
    }

    public var protocolVersion: ProtocolVersion = .castV210
    public var sourceId: String = ""
    public var destinationId: String = ""
    public var namespace: String = ""
    public var payloadType: PayloadType = .string
    public var payloadUtf8: String?
    public var payloadBinary: Data?

    public init() {}

    // MARK: - Protobuf Wire Encoding

    /// Encodes a varint to Data.
    internal static func encodeVarint(_ value: Int32) -> Data {
        var val = value
        var data = Data()
        while val >= 0x80 {
            data.append(UInt8(truncatingIfNeeded: val) | 0x80)
            val >>= 7
        }
        data.append(UInt8(truncatingIfNeeded: val))
        return data
    }

    /// Encodes a string (length-delimited) to Data.
    internal static func encodeString(_ value: String) -> Data {
        let bytes = Array(value.utf8)
        var data = encodeVarint(Int32(bytes.count))
        data.append(contentsOf: bytes)
        return data
    }

    /// Encodes bytes (length-delimited) to Data.
    internal static func encodeBytes(_ value: Data) -> Data {
        var data = encodeVarint(Int32(value.count))
        data.append(value)
        return data
    }

    /// Encodes field tag for varint fields.
    /// Field tag = (field_number << 3) | wire_type(0)
    internal static func varintTag(field: Int) -> UInt8 {
        UInt8((field << 3) | 0)
    }

    /// Encodes field tag for length-delimited fields.
    /// Field tag = (field_number << 3) | wire_type(2)
    internal static func lengthDelimitedTag(field: Int) -> UInt8 {
        UInt8((field << 3) | 2)
    }

    // MARK: - Marshal

    /// Serializes CastMessage to Data using manual protobuf encoding.
    public func marshal() -> Data {
        var data = Data()

        // Field 1: protocol_version (varint, required)
        data.append(CastMessage.varintTag(field: 1))
        data.append(CastMessage.encodeVarint(protocolVersion.rawValue))

        // Field 2: source_id (string, required)
        data.append(CastMessage.lengthDelimitedTag(field: 2))
        data.append(CastMessage.encodeString(sourceId))

        // Field 3: destination_id (string, required)
        data.append(CastMessage.lengthDelimitedTag(field: 3))
        data.append(CastMessage.encodeString(destinationId))

        // Field 4: namespace (string, required)
        data.append(CastMessage.lengthDelimitedTag(field: 4))
        data.append(CastMessage.encodeString(namespace))

        // Field 5: payload_type (varint, required)
        data.append(CastMessage.varintTag(field: 5))
        data.append(CastMessage.encodeVarint(payloadType.rawValue))

        // Field 6: payload_utf8 (string, optional)
        if let utf8 = payloadUtf8, !utf8.isEmpty {
            data.append(CastMessage.lengthDelimitedTag(field: 6))
            data.append(CastMessage.encodeString(utf8))
        }

        // Field 7: payload_binary (bytes, optional)
        if let binary = payloadBinary, !binary.isEmpty {
            data.append(CastMessage.lengthDelimitedTag(field: 7))
            data.append(CastMessage.encodeBytes(binary))
        }

        return data
    }

    // MARK: - Unmarshal

    /// Decodes a varint from Data, returns (value, bytesConsumed).
    internal static func decodeVarint(_ data: Data, offset: Int) -> (Int32, Int) {
        var result: Int32 = 0
        var shift = 0
        var pos = offset
        while pos < data.count {
            let byte = data[pos]
            pos += 1
            result |= Int32(byte & 0x7F) << shift
            if byte & 0x80 == 0 {
                return (result, pos - offset)
            }
            shift += 7
        }
        return (result, pos - offset)
    }

    /// Decodes a length-delimited field, returns (data, bytesConsumed).
    internal static func decodeLengthDelimited(_ data: Data, offset: Int) -> (Data, Int) {
        let (length, lenBytes) = decodeVarint(data, offset: offset)
        let start = offset + lenBytes
        let end = start + Int(length)
        guard end <= data.count else {
            return (Data(), data.count - offset)
        }
        return (data.subdata(in: start..<end), end - offset)
    }

    /// Parses field header and returns (fieldNumber, wireType).
    private static func parseFieldHeader(_ data: Data, pos: inout Int) -> (Int, Int)? {
        guard pos < data.count else { return nil }
        let tagByte = data[pos]
        pos += 1
        return (Int(tagByte >> 3), Int(tagByte & 0x07))
    }

    /// Decodes a varint field and advances position.
    private static func decodeVarintField(_ data: Data, pos: inout Int) -> Int32? {
        let (value, consumed) = decodeVarint(data, offset: pos)
        guard consumed > 0 else { return nil }
        pos += consumed
        return value
    }

    /// Decodes a length-delimited field and advances position.
    private static func decodeLengthDelimitedField(_ data: Data, pos: inout Int) -> Data? {
        let (value, consumed) = decodeLengthDelimited(data, offset: pos)
        pos += consumed
        return value
    }

    /// Decodes string field and returns string value.
    private static func decodeStringField(_ data: Data, pos: inout Int) -> String {
        guard let fieldData = decodeLengthDelimitedField(data, pos: &pos) else { return "" }
        return String(data: fieldData, encoding: .utf8) ?? ""
    }

    /// Skips unknown field based on wire type.
    private static func skipUnknownField(_ data: Data, pos: inout Int, wireType: Int) -> Bool {
        if wireType == 0 {
            guard decodeVarintField(data, pos: &pos) != nil else { return false }
        } else if wireType == 2 {
            guard decodeLengthDelimitedField(data, pos: &pos) != nil else { return false }
        } else {
            return false
        }
        return true
    }

    /// Deserializes Data to CastMessage using manual protobuf decoding.
    public static func unmarshal(_ data: Data) -> CastMessage? {
        var msg = CastMessage()
        var pos = 0

        while pos < data.count {
            guard let (fieldNumber, wireType) = parseFieldHeader(data, pos: &pos) else {
                return nil
            }

            guard decodeField(fieldNumber, wireType: wireType, data: data, pos: &pos, msg: &msg) else {
                return nil
            }
        }

        return msg
    }

    /// Decodes a single field and populates the message.
    private static func decodeField(
        _ fieldNumber: Int,
        wireType: Int,
        data: Data,
        pos: inout Int,
        msg: inout CastMessage
    ) -> Bool {
        switch (fieldNumber, wireType) {
        case (1, 0):
            return decodeProtocolVersionField(data, pos: &pos, msg: &msg)
        case (2, 2):
            return decodeSourceIdField(data, pos: &pos, msg: &msg)
        case (3, 2):
            return decodeDestinationIdField(data, pos: &pos, msg: &msg)
        case (4, 2):
            return decodeNamespaceField(data, pos: &pos, msg: &msg)
        case (5, 0):
            return decodePayloadTypeField(data, pos: &pos, msg: &msg)
        case (6, 2):
            return decodePayloadUtf8Field(data, pos: &pos, msg: &msg)
        case (7, 2):
            return decodePayloadBinaryField(data, pos: &pos, msg: &msg)
        default:
            return skipUnknownField(data, pos: &pos, wireType: wireType)
        }
    }

    private static func decodeProtocolVersionField(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        guard let value = decodeVarintField(data, pos: &pos) else { return false }
        msg.protocolVersion = ProtocolVersion(rawValue: value) ?? .castV210
        return true
    }

    private static func decodeSourceIdField(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        msg.sourceId = decodeStringField(data, pos: &pos)
        return true
    }

    private static func decodeDestinationIdField(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        msg.destinationId = decodeStringField(data, pos: &pos)
        return true
    }

    private static func decodeNamespaceField(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        msg.namespace = decodeStringField(data, pos: &pos)
        return true
    }

    private static func decodePayloadTypeField(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        guard let value = decodeVarintField(data, pos: &pos) else { return false }
        msg.payloadType = PayloadType(rawValue: value) ?? .string
        return true
    }

    private static func decodePayloadUtf8Field(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        msg.payloadUtf8 = decodeLengthDelimitedField(data, pos: &pos).flatMap {
            String(data: $0, encoding: .utf8)
        }
        return true
    }

    private static func decodePayloadBinaryField(_ data: Data, pos: inout Int, msg: inout CastMessage) -> Bool {
        msg.payloadBinary = decodeLengthDelimitedField(data, pos: &pos)
        return true
    }

    // MARK: - Helpers

    /// Creates a text message with JSON payload.
    public static func textMessage(
        sourceId: String,
        destinationId: String,
        namespace: String,
        json: String
    ) -> CastMessage {
        var msg = CastMessage()
        msg.sourceId = sourceId
        msg.destinationId = destinationId
        msg.namespace = namespace
        msg.payloadType = .string
        msg.payloadUtf8 = json
        return msg
    }

    /// Creates a binary message.
    public static func binaryMessage(
        sourceId: String,
        destinationId: String,
        namespace: String,
        data: Data
    ) -> CastMessage {
        var msg = CastMessage()
        msg.sourceId = sourceId
        msg.destinationId = destinationId
        msg.namespace = namespace
        msg.payloadType = .binary
        msg.payloadBinary = data
        return msg
    }
}
