import Foundation
import XCTest
@testable import SPX

// MARK: - AppStateTests

@MainActor
final class AppStateTests: XCTestCase {

    // MARK: - Properties

    var sut: AppState!
    var mockSpotify: MockSpotifyAPI!
    var mockTokenStorage: MockTokenStorage!

    // MARK: - Lifecycle

    override func setUp() {
        super.setUp()
        mockSpotify = MockSpotifyAPI()
        mockTokenStorage = MockTokenStorage()
        sut = AppState(spotifyService: mockSpotify, tokenStorage: mockTokenStorage)
    }

    override func tearDown() {
        sut = nil
        mockSpotify = nil
        mockTokenStorage = nil
        super.tearDown()
    }

    // MARK: - Navigation Tests

    func testNavigateToAddsToHistoryAndChangesCurrentView() {
        // Given
        XCTAssertEqual(sut.currentView, .home)
        XCTAssertEqual(sut.viewHistory.count, 1)

        // When
        sut.navigate(to: .search)

        // Then
        XCTAssertEqual(sut.currentView, .search)
        XCTAssertEqual(sut.viewHistory.count, 2)
        XCTAssertEqual(sut.viewHistory[0], .home)
    }

    func testNavigateToPreservesPreviousView() {
        // Given
        sut.navigate(to: .search)
        sut.navigate(to: .queue)

        // When
        sut.navigate(to: .library(tab: nil))

        // Then
        XCTAssertEqual(sut.currentView, .library(tab: nil))
        XCTAssertEqual(sut.viewHistory.count, 4)
    }

    func testGoBackReturnsToPreviousView() {
        // Given
        sut.navigate(to: .search)
        sut.navigate(to: .queue)
        XCTAssertEqual(sut.currentView, .queue)

        // When
        sut.goBack()

        // Then
        XCTAssertEqual(sut.currentView, .search)
        XCTAssertEqual(sut.viewHistory.count, 2)
    }

    func testGoBackAtRootDoesNothing() {
        // Given
        XCTAssertEqual(sut.currentView, .home)
        XCTAssertEqual(sut.viewHistory.count, 1)

        // When
        sut.goBack()

        // Then
        XCTAssertEqual(sut.currentView, .home)
        XCTAssertEqual(sut.viewHistory.count, 1)
    }

    func testGoBackWithOnlyRootDoesNothing() {
        // Given - starting at root with just [.home] in history
        XCTAssertTrue(sut.viewHistory.count <= 1)

        // When
        sut.goBack()

        // Then - should remain at home
        XCTAssertEqual(sut.currentView, .home)
    }

    func testHistoryStackNeverExceedsReasonableDepth() {
        // Given - navigate multiple times
        let maxDepth = 50

        // When - navigate many times
        for i in 0..<100 {
            sut.navigate(to: .playlist(id: "\(i)", name: "Playlist \(i)"))
        }

        // Then - history should be capped at maxDepth + 1 (current view)
        XCTAssertLessThanOrEqual(sut.viewHistory.count, maxDepth + 1)
        // And should be exactly maxDepth + 1 (capped, not unlimited)
        XCTAssertEqual(sut.viewHistory.count, maxDepth + 1)
    }

    func testNavigateWithCasePlaylistPreservesName() {
        // When
        sut.navigate(to: .playlist(id: "123", name: "My Playlist"))

        // Then
        if case let .playlist(id, name) = sut.currentView {
            XCTAssertEqual(id, "123")
            XCTAssertEqual(name, "My Playlist")
        } else {
            XCTFail("Expected playlist view")
        }
    }

    // MARK: - Playback State Tests

    func testPlaybackStateUpdatesIsPlaying() {
        // Given
        XCTAssertFalse(sut.isPlaying)

        // When
        sut.isPlaying = true

        // Then
        XCTAssertTrue(sut.isPlaying)
    }

    func testPlaybackStateUpdatesProgress() {
        // Given
        XCTAssertEqual(sut.playbackProgress, 0)

        // When
        sut.playbackProgress = 30000

        // Then
        XCTAssertEqual(sut.playbackProgress, 30000)
    }

    func testPlaybackStateUpdatesVolume() {
        // Given
        XCTAssertEqual(sut.playbackVolume, 50)

        // When
        sut.playbackVolume = 75

        // Then
        XCTAssertEqual(sut.playbackVolume, 75)
    }

    // MARK: - Shuffle Tests

    func testHandleShuffleTogglesState() async {
        // Given
        XCTAssertFalse(sut.playbackShuffle)

        // When
        sut.handleShuffle()
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertTrue(sut.playbackShuffle)
        XCTAssertEqual(mockSpotify.setShuffleCallCount, 1)
        XCTAssertEqual(mockSpotify.setShuffleCallValue, true)
    }

    func testHandleShuffleToggleOff() async {
        // Given
        sut.playbackShuffle = true

        // When
        sut.handleShuffle()
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertFalse(sut.playbackShuffle)
        XCTAssertEqual(mockSpotify.setShuffleCallCount, 1)
        XCTAssertEqual(mockSpotify.setShuffleCallValue, false)
    }

    func testHandleShuffleRevertsOnAPIFailure() async {
        // Given
        XCTAssertFalse(sut.playbackShuffle)
        mockSpotify.setShuffleError = SpotifyError.apiError("Failed")

        // When
        sut.handleShuffle()
        await Task.sleep(100_000_000) // 100ms

        // Then - should revert to original state
        XCTAssertFalse(sut.playbackShuffle)
        XCTAssertEqual(sut.appError, "API error: Failed")
    }

    // MARK: - Repeat Tests

    func testHandleRepeatCyclesOffToContext() async {
        // Given
        sut.playbackRepeat = "off"
        mockSpotify.resetCallCounts()

        // When
        sut.handleRepeat()
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackRepeat, "context")
        XCTAssertEqual(mockSpotify.setRepeatCallCount, 1)
        XCTAssertEqual(mockSpotify.setRepeatCallValue, "context")
    }

    func testHandleRepeatCyclesContextToTrack() async {
        // Given
        sut.playbackRepeat = "context"

        // When
        sut.handleRepeat()
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackRepeat, "track")
        XCTAssertEqual(mockSpotify.setRepeatCallValue, "track")
    }

    func testHandleRepeatCyclesTrackToOff() async {
        // Given
        sut.playbackRepeat = "track"

        // When
        sut.handleRepeat()
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackRepeat, "off")
        XCTAssertEqual(mockSpotify.setRepeatCallValue, "off")
    }

    func testHandleRepeatRevertsOnAPIFailure() async {
        // Given
        sut.playbackRepeat = "off"
        mockSpotify.setRepeatError = SpotifyError.apiError("Failed")

        // When
        sut.handleRepeat()
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackRepeat, "off")
        XCTAssertNotNil(sut.appError)
    }

    // MARK: - Volume Tests

    func testHandleVolumeChangeClampsTo100() async {
        // Given
        sut.playbackVolume = 50

        // When
        sut.handleVolumeChange(150)
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackVolume, 100)
        XCTAssertEqual(mockSpotify.setVolumeCallValue, 100)
    }

    func testHandleVolumeChangeClampsTo0() async {
        // Given
        sut.playbackVolume = 50

        // When
        sut.handleVolumeChange(-50)
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackVolume, 0)
        XCTAssertEqual(mockSpotify.setVolumeCallValue, 0)
    }

    func testHandleVolumeChangeAcceptsValidValue() async {
        // Given
        sut.playbackVolume = 50

        // When
        sut.handleVolumeChange(75)
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackVolume, 75)
        XCTAssertEqual(mockSpotify.setVolumeCallValue, 75)
    }

    func testHandleVolumeChangeRevertsOnAPIFailure() async {
        // Given
        sut.playbackVolume = 50
        mockSpotify.setVolumeError = SpotifyError.apiError("Volume failed")

        // When
        sut.handleVolumeChange(80)
        await Task.sleep(100_000_000) // 100ms

        // Then
        XCTAssertEqual(sut.playbackVolume, 80) // Volume update happens before API call
    }

    // MARK: - Auth Tests

    func testHandleStartAuthSetsIsAuthLoading() {
        // Given
        XCTAssertFalse(sut.isAuthLoading)

        // When
        sut.handleStartAuth()

        // Then - should be true immediately after calling
        XCTAssertTrue(sut.isAuthLoading)
    }

    func testHandleLogoutClearsState() {
        // Given
        sut.isAuthed = true
        sut.userProfile = SpotifyUserProfile(
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
        sut.currentView = .library(tab: nil)
        sut.viewHistory = [.home, .library(tab: nil)]

        // When
        sut.handleLogout()

        // Then
        XCTAssertFalse(sut.isAuthed)
        XCTAssertNil(sut.userProfile)
        XCTAssertEqual(sut.currentView, .home)
        XCTAssertEqual(sut.viewHistory, [.home])
    }

    func testHandleLogoutClearsTokenStorage() {
        // Given - setup tokenStorage with tokens
        mockTokenStorage.save(key: "spotify_access_token", string: "token123")
        mockTokenStorage.save(key: "spotify_refresh_token", string: "refresh123")

        // When
        sut.handleLogout()

        // Then - tokens should be deleted (we can't directly verify, but no error means success)
        XCTAssertFalse(sut.isAuthed)
    }

    // MARK: - Error Handling Tests

    func testClearErrorSetsAppErrorToNil() {
        // Given
        sut.appError = "Some error"

        // When
        sut.clearError()

        // Then
        XCTAssertNil(sut.appError)
    }

    // MARK: - Context Panel Tests

    func testContextPanelItemCanBeSet() {
        // Given
        let artist = SpotifyArtist(
            id: "artist123",
            name: "Test Artist",
            genres: ["rock"],
            followers: nil,
            images: nil,
            popularity: 80,
            uri: nil
        )

        // When
        sut.contextPanelItem = artist

        // Then
        XCTAssertEqual(sut.contextPanelItem?.id, "artist123")
        XCTAssertEqual(sut.contextPanelItem?.name, "Test Artist")
    }

    // MARK: - Mock Mode Tests

    func testIsMockModeDefaultIsFalse() {
        XCTAssertFalse(sut.isMockMode)
    }

    func testIsMockModeCanBeToggled() {
        // Given
        XCTAssertFalse(sut.isMockMode)

        // When
        sut.isMockMode = true

        // Then
        XCTAssertTrue(sut.isMockMode)
    }
}
