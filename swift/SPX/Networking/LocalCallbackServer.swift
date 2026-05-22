import Foundation
import Network

// MARK: - Local Callback Server

actor LocalCallbackServer {
    private let port: UInt16
    private let completion: (String, String) -> Void
    private var listener: NWListener?

    init(port: UInt16, completion: @escaping (String, String) -> Void) {
        self.port = port
        self.completion = completion
    }

    func start() throws {
        guard let nwPort = NWEndpoint.Port(rawValue: port) else {
            throw NSError(
                domain: "LocalCallbackServer",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Invalid port"]
            )
        }
        let parameters = NWParameters.tcp
        listener = try NWListener(using: parameters, on: nwPort)

        listener?.stateUpdateHandler = { state in
            if case .ready = state {
                print("[OAuth] Callback server ready on port \(self.port)")
            } else if case .failed(let error) = state {
                print("[OAuth] Callback server failed: \(error)")
            }
        }

        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }

        listener?.start(queue: .global())
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private nonisolated func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .global())

        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }

            let parsed = self.parseCallbackData(data)
            self.sendResponse(connection: connection, code: parsed.code)
            if let code = parsed.code, let state = parsed.state {
                self.completion(code, state)
            }
        }
    }

    private nonisolated func parseCallbackData(_ data: Data?) -> (code: String?, state: String?) {
        var code: String?
        var state: String?

        guard let data = data,
              let request = String(data: data, encoding: .utf8) else {
            return (nil, nil)
        }

        for line in request.components(separatedBy: "\r\n") {
            if line.starts(with: "GET /callback?") {
                let queryString = line.dropFirst("GET /callback?".count)
                    .trimmingCharacters(in: .whitespaces)
                    .components(separatedBy: " ").first ?? ""

                let params = parseQueryString(queryString)
                code = params["code"]
                state = params["state"]
                break
            }
        }

        return (code, state)
    }

    private nonisolated func parseQueryString(_ queryString: String) -> [String: String] {
        var params: [String: String] = [:]

        for param in queryString.components(separatedBy: "&") {
            let parts = param.components(separatedBy: "=")
            if parts.count >= 2 {
                let key = parts[0]
                let value = parts[1...].joined(separator: "=")
                    .removingPercentEncoding ?? parts[1]
                params[key] = value
            }
        }

        return params
    }

    private nonisolated func sendResponse(connection: NWConnection, code: String?) {
        let body: String
        if code != nil {
            body = """
            <html><body style='font-family:sans-serif;text-align:center;padding:40px'>
            <h1>Auth Successful!</h1>
            <p>You can close this window and return to SPX.</p>
            </body></html>
            """
        } else {
            body = """
            <html><body><h1>Auth Failed</h1>
            <p>No authorization code received.</p></body></html>
            """
        }

        let response = [
            "HTTP/1.1 200 OK",
            "Content-Type: text/html",
            "Content-Length: \(body.utf8.count)",
            "Connection: close",
            "\r\n\(body)"
        ].joined(separator: "\r\n")

        connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in
            connection.cancel()
        })
    }
}
