import Foundation
import Network

// MARK: - CastConnection

/// TLS connection to Cast device with length-prefixed framing and heartbeat.
public final class CastConnection {
    public typealias MessageHandler = (CastMessage) -> Void
    public typealias ErrorHandler = (Error) -> Void

    public enum ConnectionError: Error {
        case connectionFailed
        case tlsFailed(Error)
        case streamClosed
        case invalidLength
        case writeFailed
        case readFailed
        case timeout
    }

    private var connection: NWConnection?
    private let host: String
    private let port: UInt16 = 8009
    private var sourceId: String
    private var heartbeatTimer: Timer?
    private var readCompleteHandler: ((Error?) -> Void)?
    private var pendingReadLength: Int = 0
    private var readBuffer = Data()

    public var onMessage: MessageHandler?
    public var onError: ErrorHandler?
    public var onConnected: (() -> Void)?

    private var receiveContinuation: CheckedContinuation<CastMessage, Error>?

    public init(host: String, sourceId: String = "sender-0") {
        self.host = host
        self.sourceId = sourceId
    }

    deinit {
        disconnect()
    }

    // MARK: - Connect

    public func connect() {
        let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!)

        // TLS parameters allowing self-signed certificates
        let tlsOptions = NWProtocolTLS.Options()
        sec_protocol_options_set_verify_block(
            tlsOptions.securityProtocolOptions,
            { _, secTrust, completionHandler in
                // Allow self-signed certs - always verify success
                completionHandler(true)
            },
            DispatchQueue.global()
        )

        let tcpOptions = NWProtocolTCP.Options()
        tcpOptions.enableKeepalive = true
        tcpOptions.keepaliveIdle = 30

        let parameters = NWParameters(tls: tlsOptions, tcp: tcpOptions)
        parameters.prohibitExpensivePaths = false
        parameters.prohibitedInterfaceTypes = []

        connection = NWConnection(to: endpoint, using: parameters)

        connection?.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                DispatchQueue.main.async {
                    self?.onConnected?()
                    self?.startReading()
                }
            case .failed(let error):
                DispatchQueue.main.async {
                    self?.onError?(ConnectionError.tlsFailed(error))
                }
            case .cancelled:
                break
            default:
                break
            }
        }

        connection?.start(queue: .global(qos: .userInitiated))
    }

    public func disconnect() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        connection?.cancel()
        connection = nil
    }

    // MARK: - Heartbeat

    public func startHeartbeat() {
        DispatchQueue.main.async { [weak self] in
            self?.heartbeatTimer?.invalidate()
            self?.heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
                self?.sendPing()
            }
        }
    }

    public func stopHeartbeat() {
        DispatchQueue.main.async { [weak self] in
            self?.heartbeatTimer?.invalidate()
            self?.heartbeatTimer = nil
        }
    }

    private func sendPing() {
        let pingJson = "{\"type\":\"PING\"}"
        let message = CastMessage.textMessage(
            sourceId: sourceId,
            destinationId: "receiver-0",
            namespace: "urn:x-cast:com.google.cast.tp.heartbeat",
            json: pingJson
        )
        send(message: message)
    }

    // MARK: - Send

    /// Sends a CastMessage with 4-byte big-endian length prefix.
    public func send(message: CastMessage) {
        let payload = message.marshal()
        var framedData = Data()

        // 4-byte big-endian length
        var length = UInt32(payload.count).bigEndian
        withUnsafeBytes(of: &length) { framedData.append(contentsOf: $0) }
        framedData.append(payload)

        connection?.send(content: framedData, completion: .contentProcessed { [weak self] error in
            if let error = error {
                DispatchQueue.main.async {
                    self?.onError?(error)
                }
            }
        })
    }

    // MARK: - Read

    private func startReading() {
        readLengthPrefix()
    }

    private func readLengthPrefix() {
        // Read exactly 4 bytes for length
        connection?.receive(minimumIncompleteLength: 4, maximumLength: 4) { [weak self] data, context, isComplete, error in
            guard let self = self else { return }

            if let error = error {
                DispatchQueue.main.async {
                    self.onError?(ConnectionError.readFailed)
                }
                return
            }

            guard let data = data, data.count == 4 else {
                DispatchQueue.main.async {
                    self.onError?(ConnectionError.invalidLength)
                }
                return
            }

            // Decode big-endian uint32
            let length = data.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }

            if length > 0 && length < 1_000_000 {
                self.pendingReadLength = Int(length)
                self.readBuffer = Data()
                self.readPayload()
            } else {
                DispatchQueue.main.async {
                    self.onError?(ConnectionError.invalidLength)
                }
            }
        }
    }

    private func readPayload() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: pendingReadLength) { [weak self] data, context, isComplete, error in
            guard let self = self else { return }

            if let error = error {
                DispatchQueue.main.async {
                    self.onError?(ConnectionError.readFailed)
                }
                return
            }

            guard let data = data else {
                DispatchQueue.main.async {
                    self.onError?(ConnectionError.streamClosed)
                }
                return
            }

            // Parse protobuf message
            if let message = CastMessage.unmarshal(data) {
                // If a caller is waiting via recv(), deliver to them first
                if let continuation = self.receiveContinuation {
                    self.receiveContinuation = nil
                    continuation.resume(returning: message)
                } else {
                    DispatchQueue.main.async {
                        self.onMessage?(message)
                    }
                }
            }

            // Continue reading next message
            self.readLengthPrefix()
        }
    }

    // MARK: - Convenience

    /// Sends a JSON text message.
    public func sendJSON(
        destinationId: String,
        namespace: String,
        json: String
    ) {
        let message = CastMessage.textMessage(
            sourceId: sourceId,
            destinationId: destinationId,
            namespace: namespace,
            json: json
        )
        send(message: message)
    }

    /// Sends CONNECT message.
    public func sendConnect(destinationId: String = "receiver-0") {
        let connectJson = """
        {
            "type": "CONNECT",
            "origin": {},
            "userAgent": "Spotify/1234567890",
            "senderInfo": {
                "sdkType": 2,
                "version": "1.0.0",
                "platform": 4,
                "connectionType": 1
            }
        }
        """
        sendJSON(
            destinationId: destinationId,
            namespace: "urn:x-cast:com.google.cast.tp.connection",
            json: connectJson
        )
    }

    /// Receives a single message, returning it or timing out.
    public func recv(timeout: TimeInterval = 10.0) async throws -> CastMessage {
        return try await withCheckedThrowingContinuation { continuation in
            self.receiveContinuation = continuation

            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { [weak self] in
                guard let self = self else { return }
                if self.receiveContinuation != nil {
                    self.receiveContinuation = nil
                    continuation.resume(throwing: ConnectionError.timeout)
                }
            }
        }
    }
}
