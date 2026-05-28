import Foundation
@testable import SPX

// MARK: - MockSpotifyAPI

/// Mock implementation of SpotifyServiceProtocol for unit testing
@MainActor
final class MockSpotifyAPI: SpotifyServiceProtocol {

    // MARK: - Test Data Configuration

    var mockUserProfile: SpotifyUserProfile?
    var mockPlaybackState: SpotifyPlaybackState?
    var mockDevices: [SpotifyDevice] = []
    var mockLocalDevices: [LocalDevice] = []
    var likedTracks: Set<String> = []
    var mockSearchResults: SpotifySearchResults?

    // MARK: - Error Configuration

    var authorizeError: Error?
    var getCurrentUserError: Error?
    var getPlaybackStateError: Error?
    var pauseError: Error?
    var resumeError: Error?
    var nextError: Error?
    var previousError: Error?
    var seekError: Error?
    var setVolumeError: Error?
    var setShuffleError: Error?
    var setRepeatError: Error?
    var playContextError: Error?
    var playUrisError: Error?
    var saveTrackError: Error?
    var removeTrackError: Error?
    var checkTrackError: Error?
    var getDevicesError: Error?
    var transferPlaybackError: Error?
    var searchError: Error?

    // MARK: - Call Tracking

    private(set) var authorizeCallCount = 0
    private(set) var pauseCallCount = 0
    private(set) var resumeCallCount = 0
    private(set) var nextCallCount = 0
    private(set) var previousCallCount = 0
    private(set) var seekCallCount = 0
    private(set) var seekCallValue: Int?
    private(set) var setVolumeCallCount = 0
    private(set) var setVolumeCallValue: Int?
    private(set) var setShuffleCallCount = 0
    private(set) var setShuffleCallValue: Bool?
    private(set) var setRepeatCallCount = 0
    private(set) var setRepeatCallValue: String?
    private(set) var saveTrackCallCount = 0
    private(set) var saveTrackCallId: String?
    private(set) var removeTrackCallCount = 0
    private(set) var removeTrackCallId: String?
    private(set) var checkTrackCallCount = 0
    private(set) var checkTrackCallId: String?
    private(set) var searchCallCount = 0
    private(set) var getDevicesCallCount = 0
    private(set) var transferPlaybackCallCount = 0
    private(set) var transferPlaybackDeviceId: String?

    func resetCallCounts() {
        authorizeCallCount = 0
        pauseCallCount = 0
        resumeCallCount = 0
        nextCallCount = 0
        previousCallCount = 0
        seekCallCount = 0
        seekCallValue = nil
        setVolumeCallCount = 0
        setVolumeCallValue = nil
        setShuffleCallCount = 0
        setShuffleCallValue = nil
        setRepeatCallCount = 0
        setRepeatCallValue = nil
        saveTrackCallCount = 0
        saveTrackCallId = nil
        removeTrackCallCount = 0
        removeTrackCallId = nil
        checkTrackCallCount = 0
        checkTrackCallId = nil
        searchCallCount = 0
        getDevicesCallCount = 0
        transferPlaybackCallCount = 0
        transferPlaybackDeviceId = nil
    }

    // MARK: - SpotifyServiceProtocol

    func authorize() async throws {
        authorizeCallCount += 1
        if let error = authorizeError {
            throw error
        }
    }

    func getCurrentUser() async throws -> SpotifyUserProfile {
        if let error = getCurrentUserError {
            throw error
        }
        guard let user = mockUserProfile else {
            throw SpotifyError.notAuthenticated
        }
        return user
    }

    func getPlaybackState() async throws -> SpotifyPlaybackState {
        if let error = getPlaybackStateError {
            throw error
        }
        guard let state = mockPlaybackState else {
            throw SpotifyError.noContent
        }
        return state
    }

    func pause() async throws {
        pauseCallCount += 1
        if let error = pauseError {
            throw error
        }
    }

    func resume() async throws {
        resumeCallCount += 1
        if let error = resumeError {
            throw error
        }
    }

    func next() async throws {
        nextCallCount += 1
        if let error = nextError {
            throw error
        }
    }

    func previous() async throws {
        previousCallCount += 1
        if let error = previousError {
            throw error
        }
    }

    func seek(to positionMs: Int) async throws {
        seekCallCount += 1
        seekCallValue = positionMs
        if let error = seekError {
            throw error
        }
    }

    func setVolume(_ percent: Int) async throws {
        setVolumeCallCount += 1
        setVolumeCallValue = percent
        if let error = setVolumeError {
            throw error
        }
    }

    func setShuffle(_ enabled: Bool) async throws {
        setShuffleCallCount += 1
        setShuffleCallValue = enabled
        if let error = setShuffleError {
            throw error
        }
    }

    func setRepeat(_ mode: String) async throws {
        setRepeatCallCount += 1
        setRepeatCallValue = mode
        if let error = setRepeatError {
            throw error
        }
    }

    func playContext(uri: String) async throws {
        if let error = playContextError {
            throw error
        }
    }

    func playUris(uris: [String], offset: Int) async throws {
        if let error = playUrisError {
            throw error
        }
    }

    func saveTrack(id: String) async throws {
        saveTrackCallCount += 1
        saveTrackCallId = id
        likedTracks.insert(id)
        if let error = saveTrackError {
            throw error
        }
    }

    func removeTrack(id: String) async throws {
        removeTrackCallCount += 1
        removeTrackCallId = id
        likedTracks.remove(id)
        if let error = removeTrackError {
            throw error
        }
    }

    func checkTrack(id: String) async throws -> Bool {
        checkTrackCallCount += 1
        checkTrackCallId = id
        if let error = checkTrackError {
            throw error
        }
        return likedTracks.contains(id)
    }

    func getDevices() async throws -> [SpotifyDevice] {
        getDevicesCallCount += 1
        if let error = getDevicesError {
            throw error
        }
        return mockDevices
    }

    func getLocalDevices() async throws -> [LocalDevice] {
        return mockLocalDevices
    }

    func transferPlayback(to deviceId: String) async throws {
        transferPlaybackCallCount += 1
        transferPlaybackDeviceId = deviceId
        if let error = transferPlaybackError {
            throw error
        }
    }

    func search(query: String, types: [String], limit: Int) async throws -> SpotifySearchResults {
        searchCallCount += 1
        if let error = searchError {
            throw error
        }
        guard let results = mockSearchResults else {
            throw SpotifyError.noContent
        }
        return results
    }
}
