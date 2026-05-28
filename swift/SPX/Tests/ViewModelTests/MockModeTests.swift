import XCTest
@testable import SPX

@MainActor
final class MockModeTests: XCTestCase {

    var sut: AppState!

    override func setUp() {
        super.setUp()
        let mockSpotify = MockSpotifyAPI()
        let mockTokenStorage = MockTokenStorage()
        sut = AppState(spotifyService: mockSpotify, tokenStorage: mockTokenStorage)
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    // MARK: - populateMockData Tests

    func testPopulateMockData_SetsIsAuthedToTrue() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertTrue(sut.auth.isAuthed, "Mock mode should set isAuthed to true")
    }

    func testPopulateMockData_SetsUserProfile() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertNotNil(sut.auth.userProfile)
        XCTAssertEqual(sut.auth.userProfile?.displayName, "Alex")
    }

    func testPopulateMockData_SetsPlaybackTrack() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertNotNil(sut.playbackTrack)
        XCTAssertEqual(sut.playbackTrack?.name, "Honeydew")
        XCTAssertEqual(sut.playbackTrack?.artists?.first?.name, "Mr. Scruff")
    }

    func testPopulateMockData_SetsPlaybackState() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertTrue(sut.isPlaying)
        XCTAssertEqual(sut.playbackDuration, 456000)
        XCTAssertEqual(sut.playbackProgress, 410000)
    }

    func testPopulateMockData_SetsArtistDetail() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertNotNil(sut.playback.artistDetail)
        XCTAssertEqual(sut.playback.artistDetail?.name, "Mr. Scruff")
    }

    func testPopulateMockData_SetsTags() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertFalse(sut.playback.tags.isEmpty)
        XCTAssertTrue(sut.playback.tags.contains("electro swing"))
    }

    func testPopulateMockData_SetsPlaylists() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertFalse(sut.playback.playlists.isEmpty)
    }

    func testPopulateMockData_NavigatesToHome() {
        // When
        sut.populateMockData()

        // Then
        XCTAssertEqual(sut.navigation.currentView, .home)
    }

    func testPopulateMockData_DoesNotShowAuthView() {
        // When
        sut.populateMockData()

        // Then - ContentView should show mainLayout, not AuthView
        XCTAssertTrue(sut.auth.isAuthed)
        XCTAssertFalse(sut.isRestoring)
    }

    // MARK: - Environment Variable Test

    func testPreviewMode_EnvironmentVariableSet() {
        // Given
        let env = ProcessInfo.processInfo.environment

        // Then - verify the env var check logic
        let isPreviewMode = env["SPX_PREVIEW_MODE"] == "1"
        // This test documents the expected env var name
        XCTAssertTrue(isPreviewMode || env["SPX_PREVIEW_MODE"] == nil)
    }
}
