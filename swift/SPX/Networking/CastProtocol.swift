import Foundation

// MARK: - CastProtocol

/// High-level Cast protocol orchestrator.
public final class CastProtocol {
    public typealias Completion<T> = (Result<T, Error>) -> Void

    public enum ProtocolError: Error {
        case notConnected
        case launchFailed(String)
        case appConnectFailed
        case getInfoTimeout
        case authFailed
        case invalidResponse
    }

    public struct DeviceInfo {
        public let version: String
        public let publicKey: String
        public let remoteName: String
        public let deviceType: String
        public let brandDisplayName: String
        public let modelDisplayName: String
        public let libraryVersion: String
        public let clientID: String
        public let productID: Int
        public let status: Int
        public let statusString: String
    }

    private var connection: CastConnection?
    private var transportId: String?
    private var pendingRequestId: Int = 1
    private var getInfoResponse: DeviceInfo?
    private var getInfoCompletion: Completion<DeviceInfo>?
    private let sourceId: String

    public init(sourceId: String = "sender-0") {
        self.sourceId = sourceId
    }

    // MARK: - Platform Connect

    /// Connects to the Cast platform at receiver-0.
    public func platformConnect(host: String, completion: @escaping Completion<Void>) {
        connection = CastConnection(host: host, sourceId: sourceId)

        connection?.onMessage = { [weak self] message in
            self?.handleMessage(message)
        }

        connection?.onError = { error in
            completion(.failure(error))
        }

        connection?.onConnected = { [weak self] in
            // Send initial CONNECT to receiver-0
            self?.connection?.sendConnect(destinationId: "receiver-0")
            // Start heartbeat
            self?.connection?.startHeartbeat()
            completion(.success(()))
        }

        connection?.connect()
    }

    // MARK: - Launch Spotify

    /// Launches the Spotify receiver app and returns transportId.
    public func launchSpotify(completion: @escaping Completion<String>) {
        guard let connection = connection else {
            completion(.failure(ProtocolError.notConnected))
            return
        }

        let requestId = pendingRequestId
        pendingRequestId += 1

        let launchJson = """
        {
            "type": "LAUNCH",
            "appId": "CC32E753",
            "requestId": \(requestId)
        }
        """

        connection.sendJSON(
            destinationId: "receiver-0",
            namespace: "urn:x-cast:com.google.cast.receiver",
            json: launchJson
        )

        // Wait for RECEIVER_STATUS or LAUNCH_ERROR response
        Task {
            do {
                let transportId = try await self.waitForLaunchResponse(
                    connection: connection,
                    requestId: requestId
                )
                DispatchQueue.main.async {
                    completion(.success(transportId))
                }
            } catch {
                DispatchQueue.main.async {
                    completion(.failure(error))
                }
            }
        }
    }

    private func waitForLaunchResponse(
        connection: CastConnection,
        requestId: Int
    ) async throws -> String {
        let timeout: TimeInterval = 10.0
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            let message = try await connection.recv(timeout: 5.0)

            // Only process messages from the receiver namespace
            guard message.namespace == "urn:x-cast:com.google.cast.receiver",
                  let jsonString = message.payloadUtf8,
                  let data = jsonString.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = json["type"] as? String else {
                continue
            }

            // Check response requestId matches our request
            guard let responseRequestId = json["requestId"] as? Int,
                  responseRequestId == requestId else {
                continue
            }

            switch type {
            case "RECEIVER_STATUS":
                guard let status = json["status"] as? [String: Any],
                      let applications = status["applications"] as? [[String: Any]] else {
                    throw ProtocolError.launchFailed("Invalid RECEIVER_STATUS payload")
                }

                // Find the Spotify app
                for app in applications {
                    guard let appId = app["appId"] as? String,
                          appId == "CC32E753",
                          let transportId = app["transportId"] as? String else {
                        continue
                    }
                    return transportId
                }
                throw ProtocolError.launchFailed("Spotify app not found in RECEIVER_STATUS")

            case "LAUNCH_ERROR":
                let errorMessage = (json["reason"] as? String) ?? "Unknown launch error"
                throw ProtocolError.launchFailed(errorMessage)

            default:
                continue
            }
        }

        throw ProtocolError.launchFailed("Launch timed out after \(Int(timeout)) seconds")
    }

    // MARK: - App Connect

    /// Connects to the launched app using its transportId.
    public func appConnect(transportId: String, completion: @escaping Completion<Void>) {
        self.transportId = transportId

        connection?.sendConnect(destinationId: transportId)
        completion(.success(()))
    }

    // MARK: - Wait for GetInfo

    /// Waits for getInfoResponse from the Spotify app.
    public func waitForGetInfo(timeout: TimeInterval = 10.0, completion: @escaping Completion<DeviceInfo>) {
        getInfoCompletion = completion

        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            if self?.getInfoCompletion != nil {
                self?.getInfoCompletion?(.failure(ProtocolError.getInfoTimeout))
                self?.getInfoCompletion = nil
            }
        }
    }

    // MARK: - Send Auth Token

    /// Sends the Spotify access token to authenticate.
    public func sendAuthToken(token: String, completion: @escaping Completion<Void>) {
        guard let transportId = transportId else {
            completion(.failure(ProtocolError.notConnected))
            return
        }

        // Format token message according to Spotify Cast protocol (SPOTIFY.md Section 6)
        let tokenJson = """
        {
            "type": "addUser",
            "payload": {
                "blob": "\(token)",
                "tokenType": "accesstoken"
            }
        }
        """

        connection?.sendJSON(
            destinationId: transportId,
            namespace: "urn:x-cast:com.spotify.chromecast.secure.v1",
            json: tokenJson
        )

        completion(.success(()))
    }

    // MARK: - Disconnect

    public func disconnect() {
        connection?.stopHeartbeat()
        connection?.disconnect()
        connection = nil
    }

    // MARK: - Message Handling

    private func handleMessage(_ message: CastMessage) {
        guard let jsonString = message.payloadUtf8,
              let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }

        switch type {
        case "PONG":
            // Heartbeat response - connection is alive
            break

        case "RECEIVER_STATUS":
            handleReceiverStatus(json)

        case "getInfoResponse":
            handleGetInfoResponse(json)

        default:
            break
        }
    }

    private func handleReceiverStatus(_ json: [String: Any]) {
        guard let status = json["status"] as? [String: Any],
              let applications = status["applications"] as? [[String: Any]],
              let app = applications.first,
              let transportId = app["transportId"] as? String else {
            return
        }

        self.transportId = transportId
    }

    private func handleGetInfoResponse(_ json: [String: Any]) {
        guard let payload = json["payload"] as? [String: Any],
              let version = payload["version"] as? String,
              let publicKey = payload["publicKey"] as? String,
              let remoteName = payload["remoteName"] as? String,
              let deviceType = payload["deviceType"] as? String,
              let brandDisplayName = payload["brandDisplayName"] as? String,
              let modelDisplayName = payload["modelDisplayName"] as? String,
              let libraryVersion = payload["libraryVersion"] as? String,
              let clientID = payload["clientID"] as? String,
              let productID = payload["productID"] as? Int,
              let status = payload["status"] as? Int,
              let statusString = payload["statusString"] as? String else {
            getInfoCompletion?(.failure(ProtocolError.invalidResponse))
            getInfoCompletion = nil
            return
        }

        let info = DeviceInfo(
            version: version,
            publicKey: publicKey,
            remoteName: remoteName,
            deviceType: deviceType,
            brandDisplayName: brandDisplayName,
            modelDisplayName: modelDisplayName,
            libraryVersion: libraryVersion,
            clientID: clientID,
            productID: productID,
            status: status,
            statusString: statusString
        )

        getInfoCompletion?(.success(info))
        getInfoCompletion = nil
    }

    // MARK: - Convenience Methods

    /// Full connection flow: connect, launch, authenticate.
    public func connectAndAuthenticate(
        host: String,
        token: String,
        completion: @escaping Completion<DeviceInfo>
    ) {
        platformConnect(host: host) { [weak self] result in
            switch result {
            case .failure(let error):
                completion(.failure(error))
            case .success:
                self?.launchSpotify { launchResult in
                    switch launchResult {
                    case .failure(let error):
                        completion(.failure(error))
                    case .success(let transportId):
                        self?.appConnect(transportId: transportId) { _ in
                            self?.waitForGetInfo { getInfoResult in
                                switch getInfoResult {
                                case .failure(let error):
                                    completion(.failure(error))
                                case .success(let info):
                                    self?.sendAuthToken(token: token) { _ in
                                        completion(.success(info))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
