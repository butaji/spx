import Foundation
import CryptoKit
import Security
import AppKit

// MARK: - SpotifyAPI

actor SpotifyAPI: SpotifyServiceProtocol {

    static let shared = SpotifyAPI()

    private let baseURL = "https://api.spotify.com/v1"
    private let accountBaseURL = "https://accounts.spotify.com"
    private let redirectURI = "http://127.0.0.1:\(Constants.Network.oauthCallbackPort)/callback"
    private let localServerPort: UInt16 = Constants.Network.oauthCallbackPort

    private var accessToken: String?
    private var refreshToken: String?
    private var tokenExpiresAt: Date?
    private var tokenScope: String?

    private var currentTask: Task<Void, Never>?
    private var tokensLoaded = false

    private func ensureTokensLoaded() async {
        if !tokensLoaded {
            if await !isMockMode {
                loadTokensFromKeychain()
            }
            tokensLoaded = true
        }
    }

    // MARK: - Mock Mode

    @MainActor private static var mockModeChecked = false
    @MainActor private static var mockModeValue = false

    @MainActor var isMockMode: Bool {
        if Self.mockModeChecked { return Self.mockModeValue }
        Self.mockModeValue = ProcessInfo.processInfo.environment["SPX_MOCK"] == "1"
        Self.mockModeChecked = true
        return Self.mockModeValue
    }

    // MARK: - Required Scopes

    private let requiredScopes = [
        "streaming",
        "user-read-recently-played",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "playlist-read-private",
        "user-read-private",
        "user-library-read",
        "user-library-modify",
        "user-top-read",
        "user-follow-read"
    ]

    // MARK: - Keychain

    private enum KeychainKey {
        static let accessToken = "com.spx.spotify.accessToken"
        static let refreshToken = "com.spx.spotify.refreshToken"
        static let tokenExpiresAt = "com.spx.spotify.tokenExpiresAt"
    }

    private init() {}
}

// MARK: - Authentication

extension SpotifyAPI {

    struct AuthTokens: Codable {
        let accessToken: String
        let refreshToken: String?
        let expiresAt: Date?
    }

    func getClientID() -> String? {
        // 1. Info.plist (for signed .app bundles)
        if let plistID = Bundle.main.object(forInfoDictionaryKey: "SPOTIFY_CLIENT_ID") as? String, !plistID.isEmpty {
            return plistID
        }
        // 2. Environment variable (for CLI / ./run.sh)
        if let envID = ProcessInfo.processInfo.environment["SPOTIFY_CLIENT_ID"], !envID.isEmpty {
            return envID
        }
        return nil
    }

    private func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 64)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func generateState() -> String {
        var bytes = [UInt8](repeating: 0, count: Constants.OAuth.stateLength)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func generateCodeChallenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    func buildAuthURL() -> URL? {
        guard let clientID = getClientID() else { return nil }
        let verifier = generateCodeVerifier()
        let challenge = generateCodeChallenge(from: verifier)
        let state = generateState()

        UserDefaults.standard.set(verifier, forKey: "spotify_code_verifier")
        UserDefaults.standard.set(state, forKey: "spotify_oauth_state")

        var components = URLComponents(string: "\(accountBaseURL)/authorize")
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "scope", value: requiredScopes.joined(separator: " ")),
            URLQueryItem(name: "state", value: state)
        ]
        return components?.url
    }

    func authenticateWithCallback(url: URL) async throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              let returnedState = components.queryItems?.first(where: { $0.name == "state" })?.value,
              let verifier = UserDefaults.standard.string(forKey: "spotify_code_verifier"),
              let expectedState = UserDefaults.standard.string(forKey: "spotify_oauth_state") else {
            throw SpotifyError.authenticationFailed
        }

        // Clean up state
        UserDefaults.standard.removeObject(forKey: "spotify_oauth_state")
        UserDefaults.standard.removeObject(forKey: "spotify_code_verifier")

        // Validate state to prevent CSRF
        if returnedState != expectedState {
            throw SpotifyError.stateMismatch
        }

        try await exchangeCodeForToken(code: code, verifier: verifier)
    }

    private func exchangeCodeForToken(code: String, verifier: String) async throws {
        guard let clientID = getClientID() else {
            throw SpotifyError.missingClientID
        }

        guard let url = URL(string: "\(accountBaseURL)/api/token") else {
            throw SpotifyError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = [
            "client_id": clientID,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirectURI,
            "code_verifier": verifier
        ].map { "\($0.key)=\($0.value)" }.joined(separator: "&")

        request.httpBody = body.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw SpotifyError.tokenExchangeFailed
        }

        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)

        // Validate scopes
        let grantedScopes = (tokenResponse.scope ?? "").split(separator: " ").map(String.init)
        let missingScopes = requiredScopes.filter { !grantedScopes.contains($0) }
        if !missingScopes.isEmpty {
            clearTokens()
            throw SpotifyError.insufficientScopes(missing: missingScopes)
        }

        saveTokens(accessToken: tokenResponse.accessToken,
                   refreshToken: tokenResponse.refreshToken,
                   expiresIn: tokenResponse.expiresIn,
                   scope: tokenResponse.scope)
    }

    func refreshAccessTokenIfNeeded() async throws {
        if let expiresAt = tokenExpiresAt, expiresAt > Date() {
            return
        }
        try await refreshTokens()
    }

    func refreshTokens() async throws {
        guard let refreshToken = refreshToken,
              let clientID = getClientID() else {
            throw SpotifyError.noRefreshToken
        }

        guard let url = URL(string: "\(accountBaseURL)/api/token") else {
            throw SpotifyError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = [
            "client_id": clientID,
            "grant_type": "refresh_token",
            "refresh_token": refreshToken
        ].map { "\($0.key)=\($0.value)" }.joined(separator: "&")

        request.httpBody = body.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw SpotifyError.tokenRefreshFailed
        }

        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        saveTokens(accessToken: tokenResponse.accessToken,
                   refreshToken: tokenResponse.refreshToken ?? refreshToken,
                   expiresIn: tokenResponse.expiresIn)
    }

    private var isMockModeEnv: Bool {
        ProcessInfo.processInfo.environment["SPX_MOCK"] == "1"
    }

    private func saveTokens(accessToken: String, refreshToken: String?, expiresIn: Int, scope: String? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.tokenExpiresAt = Date().addingTimeInterval(TimeInterval(expiresIn))
        self.tokenScope = scope

        guard !isMockModeEnv else { return }
        let storage = TokenStorage.shared
        storage.save(key: KeychainKey.accessToken, string: accessToken)
        if let refreshToken = refreshToken {
            storage.save(key: KeychainKey.refreshToken, string: refreshToken)
        }
        storage.save(key: KeychainKey.tokenExpiresAt, string: "\(tokenExpiresAt?.timeIntervalSince1970 ?? 0)")
    }

    private func loadTokensFromKeychain() {
        guard !isMockModeEnv else { return }
        let storage = TokenStorage.shared
        accessToken = storage.read(key: KeychainKey.accessToken)
        refreshToken = storage.read(key: KeychainKey.refreshToken)
        if let expiresString = storage.read(key: KeychainKey.tokenExpiresAt),
           let interval = Double(expiresString) {
            tokenExpiresAt = Date(timeIntervalSince1970: interval)
        }
    }

    func clearTokens() {
        accessToken = nil
        refreshToken = nil
        tokenExpiresAt = nil

        guard !isMockModeEnv else { return }
        let storage = TokenStorage.shared
        storage.delete(key: KeychainKey.accessToken)
        storage.delete(key: KeychainKey.refreshToken)
        storage.delete(key: KeychainKey.tokenExpiresAt)
    }

    // Note: isAuthenticated removed - use performRequest which checks tokens internally
}

// MARK: - Local Server

extension SpotifyAPI {

    func startLocalServer() -> Task<(code: String, state: String)?, Error> {
        Task {
            try await withCheckedThrowingContinuation { continuation in
                let server = LocalCallbackServer(port: localServerPort) { code, state in
                    continuation.resume(returning: (code: code, state: state))
                }
                currentTask = Task {
                    do {
                        try await server.start()
                    } catch {
                        // Server error logged but not propagated
                        Log.error("Local server error: \(error)", category: Log.auth)
                    }
                }
            }
        }
    }

    func stopLocalServer() {
        currentTask?.cancel()
        currentTask = nil
    }
}

// MARK: - API Request Helper

extension SpotifyAPI {

    private func performRequest<T: Decodable>(
        _ endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        queryItems: [URLQueryItem]? = nil,
        retryCount: Int = 0
    ) async throws -> T {
        await ensureTokensLoaded()
        try await refreshAccessTokenIfNeeded()

        guard let token = accessToken else {
            throw SpotifyError.notAuthenticated
        }

        guard let url = buildURL(endpoint: endpoint, queryItems: queryItems) else {
            throw SpotifyError.invalidURL
        }

        var request = buildRequest(url: url, method: method, token: token, body: body)
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SpotifyError.invalidResponse
        }

        let context = RequestContext(
            endpoint: endpoint,
            method: method,
            body: body,
            queryItems: queryItems,
            retryCount: retryCount
        )
        return try await handleResponse(
            httpResponse: httpResponse,
            data: data,
            context: context
        )
    }

    private func buildURL(endpoint: String, queryItems: [URLQueryItem]?) -> URL? {
        var components = URLComponents(string: "\(baseURL)\(endpoint)")
        if let queryItems = queryItems {
            components?.queryItems = queryItems
        }
        return components?.url
    }

    private func buildRequest(url: URL, method: String, token: String, body: Data?) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        return request
    }

    private struct RequestContext {
        let endpoint: String
        let method: String
        let body: Data?
        let queryItems: [URLQueryItem]?
        let retryCount: Int
    }

    private func handleResponse<T: Decodable>(
        httpResponse: HTTPURLResponse,
        data: Data,
        context: RequestContext
    ) async throws -> T {
        switch httpResponse.statusCode {
        case 200...299:
            return try JSONDecoder().decode(T.self, from: data)
        case 401:
            guard context.retryCount < 1 else {
                throw SpotifyError.tokenRefreshFailed
            }
            try await refreshTokens()
            return try await performRequest(
                context.endpoint,
                method: context.method,
                body: context.body,
                queryItems: context.queryItems,
                retryCount: context.retryCount + 1
            )
        case 204:
            if let empty = EmptyResponse() as? T {
                return empty
            }
            throw SpotifyError.noContent
        default:
            throw parseError(data: data, statusCode: httpResponse.statusCode)
        }
    }

    private func parseError(data: Data, statusCode: Int) -> SpotifyError {
        if let errorResponse = try? JSONDecoder().decode(SpotifyErrorResponse.self, from: data) {
            return .apiError(errorResponse.error.message)
        }
        return .httpError(statusCode)
    }

    private func performVoidRequest(
        _ endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        queryItems: [URLQueryItem]? = nil,
        retryCount: Int = 0
    ) async throws {
        await ensureTokensLoaded()
        try await refreshAccessTokenIfNeeded()

        guard let token = accessToken else {
            throw SpotifyError.notAuthenticated
        }

        guard let url = buildURL(endpoint: endpoint, queryItems: queryItems) else {
            throw SpotifyError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SpotifyError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            guard retryCount < 1 else {
                throw SpotifyError.tokenRefreshFailed
            }
            try await refreshTokens()
            try await performVoidRequest(
                endpoint,
                method: method,
                body: body,
                queryItems: queryItems,
                retryCount: retryCount + 1
            )
            return
        }

        guard (200...299).contains(httpResponse.statusCode) || httpResponse.statusCode == 204 else {
            throw SpotifyError.httpError(httpResponse.statusCode)
        }
    }
}

// MARK: - Player

extension SpotifyAPI {

    func getPlaybackState() async throws -> SpotifyPlaybackState {
        try await performRequest("/me/player")
    }

    func play(contextUri: String? = nil, offset: Int? = nil) async throws {
        var bodyDict: [String: Any] = [:]
        if let contextUri = contextUri {
            bodyDict["context_uri"] = contextUri
            if let offset = offset {
                bodyDict["offset"] = ["position": offset]
            }
        }

        let body = bodyDict.isEmpty ? nil : try JSONSerialization.data(withJSONObject: bodyDict)
        try await performVoidRequest("/me/player/play", method: "PUT", body: body)
    }

    func pause() async throws {
        try await performVoidRequest("/me/player/pause", method: "PUT")
    }

    func next() async throws {
        try await performVoidRequest("/me/player/next", method: "POST")
    }

    func previous() async throws {
        try await performVoidRequest("/me/player/previous", method: "POST")
    }

    func seek(to positionMs: Int) async throws {
        let queryItems = [URLQueryItem(name: "position_ms", value: "\(positionMs)")]
        try await performVoidRequest("/me/player/seek", method: "PUT", body: nil, queryItems: queryItems)
    }

    func setVolume(_ percent: Int) async throws {
        let clamped = max(0, min(100, percent))
        let queryItems = [URLQueryItem(name: "volume_percent", value: "\(clamped)")]
        try await performVoidRequest("/me/player/volume", method: "PUT", body: nil, queryItems: queryItems)
    }

    func setShuffle(_ enabled: Bool) async throws {
        let queryItems = [URLQueryItem(name: "state", value: enabled ? "true" : "false")]
        try await performVoidRequest("/me/player/shuffle", method: "PUT", body: nil, queryItems: queryItems)
    }

    func setRepeat(_ mode: String) async throws {
        let validModes = ["off", "context", "track"]
        guard validModes.contains(mode) else {
            throw SpotifyError.invalidParameter("Repeat mode must be one of: \(validModes)")
        }
        let queryItems = [URLQueryItem(name: "state", value: mode)]
        try await performVoidRequest("/me/player/repeat", method: "PUT", body: nil, queryItems: queryItems)
    }

    func getDevices() async throws -> [SpotifyDevice] {
        let response: DevicesResponse = try await performRequest("/me/player/devices")
        return response.devices
    }

    func transferPlayback(to deviceId: String) async throws {
        try await transferPlayback(to: deviceId, play: true)
    }

    func transferPlayback(to deviceId: String, play: Bool) async throws {
        let body = try JSONSerialization.data(withJSONObject: [
            "device_ids": [deviceId],
            "play": play
        ])
        try await performVoidRequest("/me/player", method: "PUT", body: body)
    }

    func getQueue() async throws -> SpotifyQueueResponse {
        try await performRequest("/me/player/queue")
    }

    func getCurrentUser() async throws -> SpotifyUserProfile {
        try await performRequest("/me")
    }

    func getLocalDevices() async throws -> [LocalDevice] {
        [] // Local devices discovered via mDNS, not Spotify API
    }

    func authorize() async throws {
        guard let authURL = buildAuthURL() else {
            throw SpotifyError.authenticationFailed
        }

        let serverTask = startLocalServer()

        #if os(macOS)
        NSWorkspace.shared.open(authURL)
        #endif

        let result = try await waitForCallback(serverTask: serverTask)

        guard let callbackURL = buildCallbackURL(code: result.code, state: result.state) else {
            throw SpotifyError.invalidURL
        }
        try await authenticateWithCallback(url: callbackURL)
    }

    private func waitForCallback(
        serverTask: Task<(code: String, state: String)?, Error>
    ) async throws -> (code: String, state: String) {
        do {
            let result = try await withThrowingTaskGroup(
                of: (code: String, state: String)?.self
            ) { group -> (code: String, state: String)? in
                group.addTask { [self] in
                    try await serverTask.value
                }

                group.addTask {
                    try await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                    throw SpotifyError.callbackTimeout
                }

                guard let result = try await group.next() else {
                    throw SpotifyError.authenticationFailed
                }
                group.cancelAll()
                return result
            }
            guard let result = result else {
                throw SpotifyError.authenticationFailed
            }
            return result
        } catch {
            serverTask.cancel()
            throw error
        }
    }

    private func buildCallbackURL(code: String, state: String) -> URL? {
        var components = URLComponents()
        components.scheme = "http"
        components.host = "127.0.0.1"
        components.port = Int(localServerPort)
        components.path = "/callback"
        components.queryItems = [
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "state", value: state)
        ]
        return components.url
    }

    func resume() async throws {
        try await play(contextUri: nil, offset: nil)
    }

    func playContext(uri: String) async throws {
        try await play(contextUri: uri, offset: nil)
    }

    func playUris(uris: [String], offset: Int = 0) async throws {
        guard let firstUri = uris.first else { return }
        try await play(contextUri: firstUri, offset: offset)
    }

    func toggleLike(trackId: String, liked: Bool) async throws {
        let endpoint = "/me/tracks?ids=\(trackId)"
        let method = liked ? "PUT" : "DELETE"
        try await performVoidRequest(endpoint, method: method, body: nil)
        let _: EmptyResponse = try await performRequest(endpoint, method: method)
    }

    func saveTrack(id: String) async throws {
        try await toggleLike(trackId: id, liked: true)
    }

    func removeTrack(id: String) async throws {
        try await toggleLike(trackId: id, liked: false)
    }

    func checkTrack(id: String) async throws -> Bool {
        let savedTracks: SpotifySavedTracks = try await performRequest("/me/tracks?ids=\(id)")
        return savedTracks.items.contains { $0.track.id == id }
    }
}

// MARK: - Browse

extension SpotifyAPI {

    func search(query: String, types: [String], limit: Int) async throws -> SpotifySearchResults {
        let queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "type", value: types.joined(separator: ",")),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "0")
        ]
        return try await performRequest("/search", queryItems: queryItems)
    }

    func getAlbum(id: String) async throws -> SpotifyAlbum {
        try await performRequest("/albums/\(id)")
    }

    func getPlaylist(id: String) async throws -> SpotifyPlaylist {
        try await performRequest("/playlists/\(id)")
    }

    func getArtist(id: String) async throws -> SpotifyArtist {
        try await performRequest("/artists/\(id)")
    }

    func getArtistTopTracks(id: String) async throws -> [SpotifyTrack] {
        let queryItems = [URLQueryItem(name: "market", value: "US")]
        let response: ArtistTopTracksResponse = try await performRequest(
            "/artists/\(id)/top-tracks",
            queryItems: queryItems
        )
        return response.tracks
    }

    func getArtistAlbums(id: String, limit: Int = 20) async throws -> [SpotifyAlbum] {
        let queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)")
        ]
        let response: ArtistAlbumsResponse = try await performRequest(
            "/artists/\(id)/albums",
            queryItems: queryItems
        )
        return response.items
    }

    func getFeaturedPlaylists(limit: Int = 20) async throws -> [SpotifyPlaylist] {
        let response: FeaturedPlaylistsResponse = try await performRequest(
            "/browse/featured-playlists",
            queryItems: [URLQueryItem(name: "limit", value: "\(limit)")]
        )
        return response.playlists.items
    }

    func getNewReleases(limit: Int = 20) async throws -> [SpotifyAlbum] {
        let response: NewReleasesResponse = try await performRequest(
            "/browse/new-releases",
            queryItems: [URLQueryItem(name: "limit", value: "\(limit)")]
        )
        return response.albums.items
    }
}

// MARK: - Library

extension SpotifyAPI {

    func getSavedTracks(limit: Int = 20, offset: Int = 0) async throws -> SpotifySavedTracks {
        let queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]
        return try await performRequest("/me/tracks", queryItems: queryItems)
    }

    func getSavedAlbums(limit: Int = 20, offset: Int = 0) async throws -> SpotifySavedAlbums {
        let queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]
        return try await performRequest("/me/albums", queryItems: queryItems)
    }

    func getUserPlaylists(limit: Int = 50, offset: Int = 0) async throws -> [SpotifyPlaylist] {
        let queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)")
        ]
        let response: UserPlaylistsResponse = try await performRequest("/me/playlists", queryItems: queryItems)
        return response.items
    }

    func getRecentlyPlayed(limit: Int = 50) async throws -> [SpotifyTrack] {
        let queryItems = [URLQueryItem(name: "limit", value: "\(limit)")]
        let response: RecentlyPlayedResponse = try await performRequest(
            "/me/player/recently-played",
            queryItems: queryItems
        )
        return response.items.map { $0.track }
    }
}

// MARK: - Response Types

private struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int
    let scope: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case scope
    }
}

struct DevicesResponse: Codable {
    let devices: [SpotifyDevice]
}

private struct ArtistTopTracksResponse: Codable {
    let tracks: [SpotifyTrack]
}

private struct ArtistAlbumsResponse: Codable {
    let items: [SpotifyAlbum]
}

private struct FeaturedPlaylistsResponse: Codable {
    let playlists: PlaylistsContainer
}

private struct NewReleasesResponse: Codable {
    let albums: NewReleasesAlbumsContainer
}

private struct NewReleasesAlbumsContainer: Codable {
    let items: [SpotifyAlbum]
}

private struct PlaylistsContainer: Codable {
    let items: [SpotifyPlaylist]
}

private struct UserPlaylistsResponse: Codable {
    let items: [SpotifyPlaylist]
}

private struct RecentlyPlayedResponse: Codable {
    let items: [RecentlyPlayedItem]

    struct RecentlyPlayedItem: Codable {
        let track: SpotifyTrack
    }
}

struct EmptyResponse: Codable {}

// MARK: - Error Response

struct SpotifyErrorResponse: Codable {
    let error: SpotifyErrorDetail

    struct SpotifyErrorDetail: Codable {
        let status: Int
        let message: String
    }
}

// MARK: - SpotifyError

enum SpotifyError: LocalizedError {
    case authenticationFailed
    case authenticationTimeout
    case missingClientID
    case tokenExchangeFailed
    case tokenRefreshFailed
    case noRefreshToken
    case notAuthenticated
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case noContent
    case apiError(String)
    case invalidParameter(String)
    case stateMismatch
    case insufficientScopes(missing: [String])
    case callbackTimeout

    var errorDescription: String? {
        switch self {
        case .authenticationFailed: return "Authentication failed"
        case .authenticationTimeout: return "Authentication timed out"
        case .missingClientID: return "Missing Spotify Client ID"
        case .tokenExchangeFailed: return "Token exchange failed"
        case .tokenRefreshFailed: return "Token refresh failed"
        case .noRefreshToken: return "No refresh token available"
        case .notAuthenticated: return "Not authenticated"
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response"
        case .httpError(let code): return "HTTP error: \(code)"
        case .noContent: return "No content"
        case .apiError(let message): return "API error: \(message)"
        case .invalidParameter(let message): return "Invalid parameter: \(message)"
        case .stateMismatch: return "OAuth state mismatch - possible CSRF attack"
        case .insufficientScopes(let missing): return "Missing scopes: \(missing.joined(separator: ", "))"
        case .callbackTimeout: return "Callback server timed out"
        }
    }
}

// MARK: - Additional Models

struct SpotifySearchResults: Codable, Sendable {
    let tracks: TracksContainer?
    let albums: AlbumsContainer?
    let artists: ArtistsContainer?
    let playlists: PlaylistsContainer?

    struct TracksContainer: Codable, Sendable {
        let items: [SpotifyTrack]
        let total: Int?
    }

    struct AlbumsContainer: Codable, Sendable {
        let items: [SpotifyAlbum]
        let total: Int?
    }

    struct ArtistsContainer: Codable, Sendable {
        let items: [SpotifyArtist]
        let total: Int?
    }

    struct PlaylistsContainer: Codable, Sendable {
        let items: [SpotifyPlaylist]
        let total: Int?
    }
}

struct SpotifyQueueResponse: Codable, Sendable {
    let currentlyPlaying: SpotifyTrack?
    let queue: [SpotifyTrack]?

    enum CodingKeys: String, CodingKey {
        case currentlyPlaying = "currently_playing"
        case queue
    }
}

struct SpotifySavedTracks: Codable, Sendable {
    let items: [SavedTrack]
    let total: Int?
    let limit: Int?
    let offset: Int?
    let next: String?
    let previous: String?
}

struct SavedTrack: Codable, Sendable {
    let addedAt: String?
    let track: SpotifyTrack

    enum CodingKeys: String, CodingKey {
        case addedAt = "added_at"
        case track
    }
}

struct SpotifySavedAlbums: Codable, Sendable {
    let items: [SavedAlbum]
    let total: Int?
    let limit: Int?
    let offset: Int?
    let next: String?
    let previous: String?
}

struct SavedAlbum: Codable, Sendable {
    let addedAt: String?
    let album: SpotifyAlbum

    enum CodingKeys: String, CodingKey {
        case addedAt = "added_at"
        case album
    }
}
