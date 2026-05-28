import Foundation

// MARK: - SpotifyServiceProtocol

/// Protocol defining Spotify API operations for testability and dependency injection
protocol SpotifyServiceProtocol: AnyObject, Sendable {
    // Authentication
    func authorize() async throws
    func getCurrentUser() async throws -> SpotifyUserProfile

    // Playback
    func getPlaybackState() async throws -> SpotifyPlaybackState
    func pause() async throws
    func resume() async throws
    func next() async throws
    func previous() async throws
    func seek(to positionMs: Int) async throws
    func setVolume(_ percent: Int) async throws
    func setShuffle(_ enabled: Bool) async throws
    func setRepeat(_ mode: String) async throws

    // Context playback
    func playContext(uri: String) async throws
    func playUris(uris: [String], offset: Int) async throws

    // Tracks
    func saveTrack(id: String) async throws
    func removeTrack(id: String) async throws
    func checkTrack(id: String) async throws -> Bool

    // Devices
    func getDevices() async throws -> [SpotifyDevice]
    func getLocalDevices() async throws -> [LocalDevice]
    func transferPlayback(to deviceId: String) async throws

    // Search
    func search(query: String, types: [String], limit: Int) async throws -> SpotifySearchResults
}

// MARK: - SpotifyAPI Conformance

// SpotifyAPI declares conformance directly in its class declaration
