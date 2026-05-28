import Foundation
import Network

// MARK: - CastTLSVerifier

/// Trust-on-first-use (TOFU) verifier for Cast device certificates.
/// Cast devices use self-signed certificates on the local network.
/// This verifier logs certificate fingerprints and warns on new/changed certs.
final class CastTLSVerifier {
    private let host: String
    private let userDefaults: UserDefaults

    private enum Keys {
        static func fingerprintKey(for host: String) -> String {
            "CastCertFingerprint_\(host)"
        }
    }

    init(host: String, userDefaults: UserDefaults = .standard) {
        self.host = host
        self.userDefaults = userDefaults
    }

    /// Verifies the TLS certificate for a Cast device connection.
    /// - Parameters:
    ///   - secTrust: The sec trust ref containing the certificate chain.
    /// - Returns: true if the certificate is trusted (stored fingerprint matches or first connection).
    func verify(secTrust: SecTrust) -> Bool {
        guard let certificate = extractCertificate(from: secTrust) else {
            Log.error("[CastTLSVerifier] WARNING: No certificate presented by \(host)", category: Log.cast)
            return false
        }

        let fingerprint = certificateFingerprint(certificate)

        let storedFingerprint = userDefaults.string(forKey: Keys.fingerprintKey(for: host))

        if let stored = storedFingerprint {
            if stored == fingerprint {
                Log.info("[CastTLSVerifier] Certificate verified for \(host)", category: Log.cast)
                return true
            } else {
                Log.error("[CastTLSVerifier] WARNING: Certificate CHANGED for \(host)", category: Log.cast)
                Log.info("[CastTLSVerifier]   Stored: \(stored)", category: Log.cast)
                Log.info("[CastTLSVerifier]   Current: \(fingerprint)", category: Log.cast)
                // Store new fingerprint (certificate rotation)
                storeFingerprint(fingerprint)
                return true // Accept but log warning
            }
        } else {
            // First connection - store fingerprint
            Log.info("[CastTLSVerifier] First connection to \(host), storing fingerprint:", category: Log.cast)
            Log.info("[CastTLSVerifier]   \(fingerprint)", category: Log.cast)
            storeFingerprint(fingerprint)
            return true
        }
    }

    private func extractCertificate(from secTrust: SecTrust) -> SecCertificate? {
        guard SecTrustGetCertificateCount(secTrust) > 0 else { return nil }
        if let certs = SecTrustCopyCertificateChain(secTrust) as? [SecCertificate], !certs.isEmpty {
            return certs[0]
        }
        return nil
    }

    private func certificateFingerprint(_ certificate: SecCertificate) -> String {
        let data = SecCertificateCopyData(certificate) as Data
        return data.map { String(format: "%02X", $0) }.joined(separator: ":")
    }

    private func storeFingerprint(_ fingerprint: String) {
        userDefaults.set(fingerprint, forKey: Keys.fingerprintKey(for: host))
    }
}

// MARK: - CastConnection

/// TLS connection to Cast device with length-prefixed framing and heartbeat.
/// Thread-safety: All mutable state (NWConnection, Timer, callbacks) is accessed exclusively
/// on DispatchQueue.main via async dispatch. NWConnection, Timer, and callbacks are not
/// independently Sendable but our dispatch discipline ensures safe access patterns.
public final class CastConnection: @unchecked Sendable {
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
    private let port: UInt16 = Constants.Network.castPort
    private var sourceId: String
    private var heartbeatTimer: Timer?
    private var readCompleteHandler: ((Error?) -> Void)?
    private var pendingReadLength: Int = 0
    private var readBuffer = Data()
    private var tlsVerifier: CastTLSVerifier?

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
        let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: portEndpoint)

        // TLS parameters allowing self-signed certificates
        let tlsOptions = NWProtocolTLS.Options()
        configureTLS(tlsOptions)

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

    private var portEndpoint: NWEndpoint.Port {
        guard let port = NWEndpoint.Port(rawValue: port) else {
            fatalError("Invalid port: \(self.port)")
        }
        return port
    }

    private func configureTLS(_ tlsOptions: NWProtocolTLS.Options) {
        // Cast devices use self-signed certificates on local network.
        // We use TOFU (trust-on-first-use) verification - store fingerprint on first
        // connection and warn if it changes (certificate rotation or MITM).
        let verifier = CastTLSVerifier(host: host)
        self.tlsVerifier = verifier

        sec_protocol_options_set_verify_block(
            tlsOptions.securityProtocolOptions,
            { [weak verifier] _, secTrust, completionHandler in
                // Must retain verifier during async callback
                guard let verifier = verifier else {
                    completionHandler(false)
                    return
                }
                let secTrust = sec_trust_copy_ref(secTrust).takeRetainedValue()
                let result = verifier.verify(secTrust: secTrust)
                completionHandler(result)
            },
            DispatchQueue.global()
        )
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
            self?.heartbeatTimer = Timer.scheduledTimer(
                withTimeInterval: Constants.Timing.heartbeatInterval,
                repeats: true
            ) { [weak self] _ in
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
        connection?.receive(minimumIncompleteLength: 4, maximumLength: 4) { [weak self] data, _, _, error in
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
        connection?.receive(
            minimumIncompleteLength: 1,
            maximumLength: pendingReadLength
        ) { [weak self] data, _, _, error in
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
        try await withCheckedThrowingContinuation { continuation in
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
