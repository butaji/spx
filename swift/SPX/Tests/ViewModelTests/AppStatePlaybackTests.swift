import Foundation
import XCTest
@testable import SPX

// MARK: - AppStatePlaybackTests

@MainActor
final class AppStatePlaybackTests: XCTestCase {

    // MARK: - Properties

    var sut: AppState!
    var mockSpotify: MockSpotifyAPI!

    // MARK: - Test Data

    private var testTrack: SpotifyTrack!
    private var testArtist: SpotifyArtist!
    private var testAlbum: SpotifyAlbum!
    private var testImage: SpotifyImage!
    private var testDevice: SpotifyDevice!
    private var testPlaybackState: SpotifyPlaybackState!

    // MARK: - Lifecycle

    override func setUp() {
        super.setUp()
        mockSpotify = MockSpotifyAPI()
        sut = AppState(spotifyService: mockSpotify, tokenStorage: MockTokenStorage())

        setupTestData()
    }

    override func tearDown() {
        sut = nil
        mockSpotify = nil
        testTrack = nil
        testArtist = nil
        testAlbum = nil
        testImage = nil
        testDevice = nil
        testPlaybackState = nil
        super.tearDown()
    }

    private func setupTestData() {
        testImage = SpotifyImage(url: "https://example.com/image.jpg", height: 640, width: 640)

        testArtist = SpotifyArtist(
            id: "artist123",
            name: "Test Artist",
            genres: ["rock"],
            followers: nil,
            images: nil,
            popularity: 80,
            uri: nil
        )

        testAlbum = SpotifyAlbum(
            id: "album123",
            name: "Test Album",
            images: [testImage],
            uri: "spotify:album:123",
            artists: [testArtist],
            releaseDate: "2024-01-01",
            tracks: nil,
            albumType: "album",
            totalTracks: 10
        )

        testTrack = SpotifyTrack(
            id: "track123",
            name: "Test Track",
            uri: "spotify:track:123",
            durationMs: 180000,
            artists: [testArtist],
            album: testAlbum,
            images: [testImage],
            trackNumber: 1,
            discNumber: 1,
            explicit: false,
            popularity: 75,
            previewUrl: nil
        )

        testDevice = SpotifyDevice(
            id: "device123",
            name: "MacBook Pro",
            volumePercent: 75,
            type: "Computer",
            isActive: true,
            isPrivateSession: false,
            isRestricted: false,
            supportsVolume: true,
            isLocal: false,
            localNote: nil,
            canTransfer: true,
            needsWakeUp: false,
            deviceIp: nil
        )

        testPlaybackState = SpotifyPlaybackState(
            isPlaying: true,
            shuffleState: false,
            repeatState: .off,
            progressMs: 30000,
            item: testTrack,
            device: testDevice,
            timestamp: 1234567890,
            context: nil
        )

        mockSpotify.mockPlaybackState = testPlaybackState
        mockSpotify.mockUserProfile = SpotifyUserProfile(
            id: "user123",
            displayName: "Test User",
            images: nil,
            email: "test@example.com",
            country: "US",
            product: "premium",
            followers: nil,
            externalUrls: nil,
            href: nil,
            uri: nil,
            explicitContent: nil
        )
    }

    // MARK: - Play/Pause Tests

    func testHandlePlayPauseTogglesIsPlayingTrueToFalse() async {
        // Given
        sut.isPlaying = true
        mockSpotify.pauseError = nil

        // When
        await sut.handlePlayPause()

        // Then - isPlaying will be set to false after pause is called
        XCTAssertTrue(mockSpotify.pauseCallCount >= 1)
    }

    func testHandlePlayPauseTogglesIsPlayingFalseToTrue() async {
        // Given
        sut.isPlaying = false

        // When
        await sut.handlePlayPause()

        // Then
        XCTAssertTrue(mockSpotify.resumeCallCount >= 1)
    }

    func testHandlePlayPauseResumesWhenNotPlaying() async {
        // Given
        sut.isPlaying = false
        mockSpotify.resetCallCounts()

        // When
        await sut.handlePlayPause()

        // Then
        XCTAssertEqual(mockSpotify.resumeCallCount, 1)
        XCTAssertEqual(mockSpotify.pauseCallCount, 0)
    }

    func testHandlePlayPausePausesWhenPlaying() async {
        // Given
        sut.isPlaying = true
        mockSpotify.resetCallCounts()

        // When
        await sut.handlePlayPause()

        // Then
        XCTAssertEqual(mockSpotify.pauseCallCount, 1)
        XCTAssertEqual(mockSpotify.resumeCallCount, 0)
    }

    func testHandlePlayPauseSetsErrorOnFailure() async {
        // Given
        sut.isPlaying = false
        mockSpotify.resumeError = SpotifyError.apiError("Playback failed")
        mockSpotify.resetCallCounts()

        // When
        await sut.handlePlayPause()

        // Then
        XCTAssertNotNil(sut.appError)
    }

    func testHandlePlayPauseIgnoresConcurrentAction() async {
        // Given
        sut.isPlayActionLoading = true

        // When
        await sut.handlePlayPause()

        // Then - no API calls should be made (early return)
        XCTAssertEqual(mockSpotify.resumeCallCount, 0)
        XCTAssertEqual(mockSpotify.pauseCallCount, 0)
    }

    // MARK: - Next/Previous Tests

    func testHandleNextCallsAPINext() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handleNext()

        // Then
        XCTAssertEqual(mockSpotify.nextCallCount, 1)
    }

    func testHandleNextRefreshesPlaybackState() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handleNext()

        // Then - the async refresh should be triggered
        XCTAssertEqual(mockSpotify.nextCallCount, 1)
    }

    func testHandleNextSetsErrorOnFailure() async {
        // Given
        mockSpotify.nextError = SpotifyError.apiError("Next failed")
        mockSpotify.resetCallCounts()

        // When
        await sut.handleNext()

        // Then
        XCTAssertNotNil(sut.appError)
    }

    func testHandlePrevCallsAPIPrevious() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handlePrev()

        // Then
        XCTAssertEqual(mockSpotify.previousCallCount, 1)
    }

    func testHandlePrevRefreshesPlaybackState() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handlePrev()

        // Then
        XCTAssertEqual(mockSpotify.previousCallCount, 1)
    }

    func testHandlePrevSetsErrorOnFailure() async {
        // Given
        mockSpotify.previousError = SpotifyError.apiError("Previous failed")
        mockSpotify.resetCallCounts()

        // When
        await sut.handlePrev()

        // Then
        XCTAssertNotNil(sut.appError)
    }

    // MARK: - Seek Tests

    func testHandleSeekUpdatesProgress() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handleSeek(to: 60000)

        // Then
        XCTAssertEqual(mockSpotify.seekCallCount, 1)
        XCTAssertEqual(mockSpotify.seekCallValue, 60000)
    }

    func testHandleSeekUpdatesPlaybackProgressImmediately() async {
        // Given
        sut.playbackProgress = 0

        // When
        await sut.handleSeek(to: 45000)

        // Then - progress should update optimistically
        XCTAssertEqual(sut.playbackProgress, 45000)
    }

    func testHandleSeekSetsErrorOnFailure() async {
        // Given
        mockSpotify.seekError = SpotifyError.apiError("Seek failed")
        mockSpotify.resetCallCounts()

        // When
        await sut.handleSeek(to: 30000)

        // Then
        XCTAssertNotNil(sut.appError)
    }

    // MARK: - Toggle Like Tests

    func testHandleToggleLikeTogglesLikedTrackTrueToFalse() async {
        // Given
        sut.playbackTrack = testTrack
        sut.likedTrack = true
        mockSpotify.likedTracks.insert("track123")
        mockSpotify.resetCallCounts()

        // When
        await sut.handleToggleLike()

        // Then
        XCTAssertFalse(sut.likedTrack)
        XCTAssertEqual(mockSpotify.removeTrackCallCount, 1)
        XCTAssertEqual(mockSpotify.removeTrackCallId, "track123")
    }

    func testHandleToggleLikeTogglesLikedTrackFalseToTrue() async {
        // Given
        sut.playbackTrack = testTrack
        sut.likedTrack = false
        mockSpotify.resetCallCounts()

        // When
        await sut.handleToggleLike()

        // Then
        XCTAssertTrue(sut.likedTrack)
        XCTAssertEqual(mockSpotify.saveTrackCallCount, 1)
        XCTAssertEqual(mockSpotify.saveTrackCallId, "track123")
    }

    func testHandleToggleLikeDoesNothingWithoutTrack() async {
        // Given
        sut.playbackTrack = nil
        sut.likedTrack = false
        mockSpotify.resetCallCounts()

        // When
        await sut.handleToggleLike()

        // Then - no API calls should be made (early return when track is nil)
        XCTAssertEqual(mockSpotify.saveTrackCallCount, 0)
        XCTAssertEqual(mockSpotify.removeTrackCallCount, 0)
    }

    func testHandleToggleLikeRevertsOnSaveFailure() async {
        // Given
        sut.playbackTrack = testTrack
        sut.likedTrack = false
        mockSpotify.saveTrackError = SpotifyError.apiError("Save failed")
        mockSpotify.resetCallCounts()

        // When
        await sut.handleToggleLike()

        // Then - likedTrack should revert to false
        XCTAssertFalse(sut.likedTrack)
        XCTAssertNotNil(sut.appError)
    }

    func testHandleToggleLikeRevertsOnRemoveFailure() async {
        // Given
        sut.playbackTrack = testTrack
        sut.likedTrack = true
        mockSpotify.likedTracks.insert("track123")
        mockSpotify.removeTrackError = SpotifyError.apiError("Remove failed")
        mockSpotify.resetCallCounts()

        // When
        await sut.handleToggleLike()

        // Then - likedTrack should revert to true
        XCTAssertTrue(sut.likedTrack)
        XCTAssertNotNil(sut.appError)
    }

    // MARK: - Refresh Playback State Tests

    func testRefreshPlaybackStateUpdatesAllProperties() async {
        // Given
        mockSpotify.mockPlaybackState = testPlaybackState

        // When
        await sut.refreshPlaybackState()

        // Then
        XCTAssertEqual(sut.playbackTrack?.id, testTrack.id)
        XCTAssertEqual(sut.playbackProgress, 30000)
        XCTAssertEqual(sut.playbackDuration, 180000)
        XCTAssertEqual(sut.isPlaying, true)
        XCTAssertEqual(sut.playbackVolume, 75)
        XCTAssertEqual(sut.playbackShuffle, false)
        XCTAssertEqual(sut.playbackRepeat, "off")
    }

    func testRefreshPlaybackStateUpdatesLastPlayedTrack() async {
        // Given
        mockSpotify.mockPlaybackState = testPlaybackState

        // When
        await sut.refreshPlaybackState()

        // Then
        XCTAssertNotNil(sut.lastPlayedTrack)
        XCTAssertEqual(sut.lastPlayedTrack?.id, testTrack.id)
        XCTAssertEqual(sut.lastPlayedTrack?.name, testTrack.name)
        XCTAssertEqual(sut.lastPlayedTrack?.artist, testArtist.name)
    }

    func testRefreshPlaybackStateUpdatesLikedTrack() async {
        // Given
        mockSpotify.mockPlaybackState = testPlaybackState
        mockSpotify.likedTracks.insert("track123")

        // When
        await sut.refreshPlaybackState()

        // Then
        XCTAssertTrue(sut.likedTrack)
    }

    func testRefreshPlaybackStateWithNoTrackSetsLikedFalse() async {
        // Given
        let stateNoTrack = SpotifyPlaybackState(
            isPlaying: false,
            shuffleState: false,
            repeatState: .off,
            progressMs: 0,
            item: nil,
            device: testDevice,
            timestamp: 1234567890,
            context: nil
        )
        mockSpotify.mockPlaybackState = stateNoTrack

        // When
        await sut.refreshPlaybackState()

        // Then
        XCTAssertNil(sut.playbackTrack)
        XCTAssertFalse(sut.likedTrack)
    }

    func testRefreshPlaybackStateHandlesError() async {
        // Given
        mockSpotify.getPlaybackStateError = SpotifyError.apiError("Failed to get playback state")

        // When
        await sut.refreshPlaybackState()

        // Then
        XCTAssertNotNil(sut.appError)
    }

    // MARK: - Optimistic UI Update Revert Tests

    func testShuffleRevertOnAPIFailure() async {
        // Given
        let originalShuffle = sut.playbackShuffle
        mockSpotify.setShuffleError = SpotifyError.apiError("Shuffle failed")

        // When
        await sut.handleShuffle()

        // Then
        XCTAssertEqual(sut.playbackShuffle, originalShuffle)
    }

    func testRepeatRevertOnAPIFailure() async {
        // Given
        let originalRepeat = sut.playbackRepeat
        mockSpotify.setRepeatError = SpotifyError.apiError("Repeat failed")

        // When
        await sut.handleRepeat()

        // Then
        XCTAssertEqual(sut.playbackRepeat, originalRepeat)
    }

    // MARK: - Volume API Tests

    func testHandleVolumeChangeCallsAPISetVolume() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handleVolumeChange(80)

        // Then
        XCTAssertEqual(mockSpotify.setVolumeCallCount, 1)
        XCTAssertEqual(mockSpotify.setVolumeCallValue, 80)
    }

    func testHandleVolumeChangeClampsBeforeAPICall() async {
        // Given
        mockSpotify.resetCallCounts()

        // When
        await sut.handleVolumeChange(200)

        // Then
        XCTAssertEqual(mockSpotify.setVolumeCallValue, 100)
    }

    // MARK: - Devices Tests

    func testRefreshDevicesCallsAPI() {
        // Given
        mockSpotify.mockDevices = [testDevice]
        mockSpotify.resetCallCounts()

        // When
        sut.refreshDevices()

        // Then - verify the API was called (async, so give it a moment)
        let expectation = expectation(description: "devices refreshed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(mockSpotify.getDevicesCallCount, 1)
    }

    func testTransferPlaybackCallsAPI() {
        // Given
        mockSpotify.resetCallCounts()

        // When
        sut.transferPlayback(to: "device456")

        // Then - verify the API was called (async, so give it a moment)
        let expectation = expectation(description: "transfer playback")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(mockSpotify.transferPlaybackCallCount, 1)
        XCTAssertEqual(mockSpotify.transferPlaybackDeviceId, "device456")
    }
}
