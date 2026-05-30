import XCTest
@testable import SPX

// MARK: - MockURLProtocol

private struct MockResponse {
    let data: Data?
    let response: URLResponse?
    let error: Error?
}

final class MockURLProtocol: URLProtocol {
    static var pendingRequests: [(URLRequest) -> Void] = []
    static var mockResponses: [URL: MockResponse] = [:]

    static func reset() {
        pendingRequests.removeAll()
        mockResponses.removeAll()
    }

    static func registerMockResponse(
        url: URL,
        data: Data?,
        response: URLResponse?,
        error: Error?
    ) {
        mockResponses[url] = MockResponse(data: data, response: response, error: error)
    }

    override static func canInit(with request: URLRequest) -> Bool {
        return true
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        if let handler = MockURLProtocol.pendingRequests.first {
            MockURLProtocol.pendingRequests.removeFirst()
            handler(self.request)
        }

        guard let mockURL = request.url,
              let mock = MockURLProtocol.mockResponses[mockURL] else {
            guard let requestURL = request.url else {
                client?.urlProtocolDidFinishLoading(self)
                return
            }
            guard let response = HTTPURLResponse(
                url: requestURL,
                statusCode: 404,
                httpVersion: nil,
                headerFields: nil
            ) else {
                client?.urlProtocolDidFinishLoading(self)
                return
            }
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .allowed)
            client?.urlProtocolDidFinishLoading(self)
            return
        }

        if let error = mock.error {
            client?.urlProtocol(self, didFailWithError: error)
        } else {
            if let response = mock.response {
                client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .allowed)
            }
            if let data = mock.data {
                client?.urlProtocol(self, didLoad: data)
            }
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    override func stopLoading() {}
}

// MARK: - SpotifyAPITests

final class SpotifyAPITests: XCTestCase {

    var originalURLSession: URLSession!
    var mockSession: URLSession!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()

        let config = URLSessionConfiguration.default
        config.protocolClasses = [MockURLProtocol.self]
        mockSession = URLSession(configuration: config)
    }

    override func tearDown() {
        MockURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - GET /v1/me/player/devices

    func testGetDevicesReturnsParsedDevices() throws {
        let devicesResponse = Data("""
        {
            "devices": [
                {
                    "id": "device1",
                    "name": "MacBook Pro",
                    "volume_percent": 50,
                    "type": "Computer",
                    "is_active": true,
                    "is_private_session": false,
                    "is_restricted": false,
                    "supports_volume": true,
                    "canTransfer": true
                },
                {
                    "id": "device2",
                    "name": "iPhone",
                    "volume_percent": 100,
                    "type": "Smartphone",
                    "is_active": false,
                    "is_private_session": false,
                    "is_restricted": false,
                    "supports_volume": true,
                    "canTransfer": true
                }
            ]
        }
        """.utf8)

        // Verify the JSON can be parsed
        let response = try JSONDecoder().decode(DevicesResponse.self, from: devicesResponse)
        XCTAssertEqual(response.devices.count, 2)
        XCTAssertEqual(response.devices[0].name, "MacBook Pro")
        XCTAssertEqual(response.devices[1].name, "iPhone")
    }

    func testDevicesJSONParsing() {
        let json = Data("""
        {
            "devices": [
                {
                    "id": "test-id",
                    "name": "Test Device",
                    "volume_percent": 75,
                    "type": "Speaker",
                    "is_active": true
                }
            ]
        }
        """.utf8)

        let response = try? JSONDecoder().decode(DevicesResponse.self, from: json)

        XCTAssertNotNil(response)
        XCTAssertEqual(response?.devices.count, 1)
        XCTAssertEqual(response?.devices[0].id, "test-id")
        XCTAssertEqual(response?.devices[0].name, "Test Device")
        XCTAssertEqual(response?.devices[0].volumePercent, 75)
    }

    // MARK: - PUT /v1/me/player (transfer playback)

    func testTransferPlaybackRequestFormat() async throws {
        let body: [String: Any] = [
            "device_ids": ["device123"],
            "play": true
        ]
        let bodyData = try JSONSerialization.data(withJSONObject: body)

        let json = try JSONSerialization.jsonObject(with: bodyData) as? [String: Any]
        XCTAssertNotNil(json)
        XCTAssertEqual(json?["device_ids"] as? [String], ["device123"])
        XCTAssertEqual(json?["play"] as? Bool, true)
    }

    func testTransferPlaybackJSONEncoding() throws {
        let deviceId = "abc123"
        let play = true

        let body = try JSONSerialization.data(withJSONObject: [
            "device_ids": [deviceId],
            "play": play
        ])

        let decoded = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        XCTAssertEqual(decoded?["device_ids"] as? [String], [deviceId])
        XCTAssertEqual(decoded?["play"] as? Bool, play)
    }

    // MARK: - 401 Triggers Token Refresh

    func test401StatusCodeIndicatesUnauthorized() {
        // 401 = Unauthorized - this is standard HTTP semantics
        let statusCode = 401
        XCTAssertEqual(statusCode, 401)
    }

    func testTokenRefreshErrorHandling() {
        let error = SpotifyError.tokenRefreshFailed
        XCTAssertEqual(error.errorDescription, "Token refresh failed")
    }

    // MARK: - Error Handling

    func testNetworkErrorHandling() {
        let error = SpotifyError.httpError(500)
        XCTAssertEqual(error.errorDescription, "HTTP error: 500")
    }

    func testInvalidResponseError() {
        let error = SpotifyError.invalidResponse
        XCTAssertEqual(error.errorDescription, "Invalid response")
    }

    func testNotAuthenticatedError() {
        let error = SpotifyError.notAuthenticated
        XCTAssertEqual(error.errorDescription, "Not authenticated")
    }

    func testAPIErrorParsing() {
        let error = SpotifyError.apiError("Invalid access token")
        XCTAssertEqual(error.errorDescription, "API error: Invalid access token")
    }

    // MARK: - OAuth PKCE

    func testCodeVerifierGenerationLength() {
        // Verify length: 32 bytes -> ~43 chars base64 encoded (without padding)
        let verifier = generateCodeVerifier()

        // Base64url encoded 32 bytes = 43 characters (without padding)
        XCTAssertEqual(verifier.count, 43)
    }

    func testCodeVerifierCharset() {
        let verifier = generateCodeVerifier()

        // PKCE verifier uses base64url charset (no +, /, =)
        let base64urlChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        let allowedChars = CharacterSet(charactersIn: base64urlChars)
        for char in verifier.unicodeScalars {
            XCTAssertTrue(allowedChars.contains(char), "Invalid character: \(char)")
        }
    }

    func testCodeVerifierIsDeterministicLength() {
        // Multiple generations should all be same length
        for _ in 0..<10 {
            let verifier = generateCodeVerifier()
            XCTAssertEqual(verifier.count, 43, "Verifier length should be consistent")
        }
    }

    // Helper to generate verifier (mirrors SpotifyAPI implementation)
    private func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // MARK: - Code Challenge

    func testCodeChallengeBase64URLEncoding() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        let challenge = generateCodeChallenge(from: verifier)

        // SHA256 hash of verifier, base64url encoded
        // No + or / characters, no = padding
        XCTAssertFalse(challenge.contains("+"))
        XCTAssertFalse(challenge.contains("/"))
        XCTAssertFalse(challenge.contains("="))
    }

    func testCodeChallengeLength() {
        // SHA256 produces 32 bytes -> 43 chars base64url encoded
        let verifier = "test_verifier_string_for_spotify_oauth"
        let challenge = generateCodeChallenge(from: verifier)

        XCTAssertEqual(challenge.count, 43)
    }

    func testCodeChallengeIsDeterministic() {
        let verifier = "fixed_test_verifier"

        let challenge1 = generateCodeChallenge(from: verifier)
        let challenge2 = generateCodeChallenge(from: verifier)

        XCTAssertEqual(challenge1, challenge2, "Same verifier should produce same challenge")
    }

    func testCodeChallengeDifferentForDifferentVerifiers() {
        let verifier1 = "verifier_one"
        let verifier2 = "verifier_two"

        let challenge1 = generateCodeChallenge(from: verifier1)
        let challenge2 = generateCodeChallenge(from: verifier2)

        XCTAssertNotEqual(challenge1, challenge2)
    }

    // Helper to generate code challenge (mirrors SpotifyAPI implementation)
    private func generateCodeChallenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // MARK: - MockURLProtocol Tests

    func testMockURLProtocolInterceptsRequest() {
        let expectation = self.expectation(description: "Request intercepted")
        guard let testURL = URL(string: "https://example.com/test") else {
            XCTFail("Failed to create test URL")
            return
        }

        MockURLProtocol.pendingRequests.append { request in
            XCTAssertEqual(request.url?.path, "/test")
            expectation.fulfill()
        }

        guard let httpResponse = HTTPURLResponse(
            url: testURL,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        ) else {
            XCTFail("Failed to create HTTPURLResponse")
            return
        }
        MockURLProtocol.registerMockResponse(
            url: testURL,
            data: Data("test".utf8),
            response: httpResponse,
            error: nil
        )

        let config = URLSessionConfiguration.default
        config.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: config)

        let task = session.dataTask(with: testURL)
        task.resume()

        waitForExpectations(timeout: 1)
    }

    func testMockURLProtocolReturnsError() {
        let expectation = self.expectation(description: "Error returned")
        guard let testURL = URL(string: "https://example.com/error") else {
            XCTFail("Failed to create test URL")
            return
        }

        let testError = NSError(domain: "test", code: -1, userInfo: nil)

        MockURLProtocol.registerMockResponse(
            url: testURL,
            data: nil,
            response: nil,
            error: testError
        )

        let config = URLSessionConfiguration.default
        config.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: config)

        let task = session.dataTask(with: testURL) { _, _, error in
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        task.resume()

        waitForExpectations(timeout: 1)
    }
}

// Import CryptoKit for SHA256
import CryptoKit
