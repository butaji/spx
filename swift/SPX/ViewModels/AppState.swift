import Foundation
import SwiftUI
import Combine

// MARK: - AppState

@MainActor
@Observable
final class AppState {

    // MARK: - Sub-Managers

    let auth: AuthState
    let playback: PlaybackState
    let navigation: NavigationState
    let devices: DeviceState

    // MARK: - App State

    var appError: String?
    var isRestoring: Bool = false
    var isMockMode: Bool = false

    // MARK: - Search State

    var searchResults: SpotifySearchResults?
    var isSearching: Bool = false
    private var searchDebounceTask: Task<Void, Never>?
    private let searchDebounceInterval: TimeInterval = Constants.Timing.searchDebounce

    // MARK: - Backward-Compatible Computed Properties

    var playbackTrack: SpotifyTrack? {
        get { playback.playbackTrack }
        set { playback.playbackTrack = newValue }
    }
    var playbackProgress: Int {
        get { playback.playbackProgress }
        set { playback.playbackProgress = newValue }
    }
    var playbackDuration: Int {
        get { playback.playbackDuration }
        set { playback.playbackDuration = newValue }
    }
    var isPlaying: Bool {
        get { playback.isPlaying }
        set { playback.isPlaying = newValue }
    }
    var playbackVolume: Int {
        get { playback.playbackVolume }
        set { playback.playbackVolume = newValue }
    }
    var isMuted: Bool {
        get { playback.isMuted }
        set { playback.isMuted = newValue }
    }
    var playbackShuffle: Bool {
        get { playback.playbackShuffle }
        set { playback.playbackShuffle = newValue }
    }
    var playbackRepeat: String {
        get { playback.playbackRepeat }
        set { playback.playbackRepeat = newValue }
    }
    var likedTrack: Bool {
        get { playback.likedTrack }
        set { playback.likedTrack = newValue }
    }
    var isPlayActionLoading: Bool {
        get { playback.isPlayActionLoading }
        set { playback.isPlayActionLoading = newValue }
    }

    var lastPlayedTrack: TrackInfo? {
        get { playback.lastPlayedTrack }
        set { playback.lastPlayedTrack = newValue }
    }

    var userProfile: SpotifyUserProfile? {
        get { auth.userProfile }
        set { auth.userProfile = newValue }
    }
    var isAuthed: Bool {
        get { auth.isAuthed }
        set { auth.isAuthed = newValue }
    }
    var isAuthLoading: Bool { auth.isAuthLoading }

    var currentView: AppView {
        get { navigation.currentView }
        set { navigation.currentView = newValue }
    }
    var viewHistory: [AppView] {
        get { navigation.viewHistory }
        set { navigation.viewHistory = newValue }
    }
    var contextPanelItem: SpotifyArtist? {
        get { navigation.contextPanelItem }
        set { navigation.contextPanelItem = newValue }
    }

    var localDevices: [LocalDevice] { devices.localDevices }
    var spotifyDevices: [SpotifyDevice] { devices.spotifyDevices }

    // MARK: - Private

    private let spotifyService: SpotifyServiceProtocol

    // MARK: - Init

    init(
        spotifyService: SpotifyServiceProtocol,
        tokenStorage: TokenStorageProtocol
    ) {
        self.spotifyService = spotifyService
        self.auth = AuthState(spotifyService: spotifyService, tokenStorage: tokenStorage)
        self.playback = PlaybackState(spotifyService: spotifyService)
        self.navigation = NavigationState()
        self.devices = DeviceState(spotifyService: spotifyService)
    }

    // MARK: - Error Handling

    func clearError() {
        appError = nil
    }

    // MARK: - Session Restore

    func restoreSession() async {
        isRestoring = true
        defer { isRestoring = false }

        do {
            userProfile = try await spotifyService.getCurrentUser()
            await playback.refreshPlaybackState()
            devices.refreshDevices()
            playback.startPlaybackPolling()
        } catch {
            appError = error.localizedDescription
        }
    }

    // MARK: - Auth Handlers (Coordinator)

    func handleStartAuth() async {
        appError = nil

        await auth.handleStartAuth()

        if auth.isAuthed {
            await restoreSession()
        }
    }

    func cancelAuth() {
        auth.cancelAuth()
        appError = nil
    }

    func handleLogout() {
        auth.handleLogout()
        playback.stopPlaybackPolling()
        navigation.resetToHome()
    }

    // MARK: - Playback Handlers (Error Delegation)

    func handlePlayPause() async {
        await playback.handlePlayPause()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handleNext() async {
        await playback.handleNext()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handlePrev() async {
        await playback.handlePrev()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handleSeek(to millis: Int) async {
        await playback.handleSeek(to: millis)
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handleVolumeChange(_ vol: Int) async {
        await playback.handleVolumeChange(vol)
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handleVolumeUp() async {
        await playback.handleVolumeUp()
    }

    func handleVolumeDown() async {
        await playback.handleVolumeDown()
    }

    func startPlaybackPolling() {
        playback.startPlaybackPolling()
    }

    func stopPlaybackPolling() {
        playback.stopPlaybackPolling()
    }

    func handleToggleMute() {
        playback.handleToggleMute()
    }

    func handleShuffle() async {
        await playback.handleShuffle()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handleRepeat() async {
        await playback.handleRepeat()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func handleToggleLike() async {
        await playback.handleToggleLike()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    func playContext(uri: String) {
        playback.playContext(uri: uri)
    }

    func playUris(uris: [String], offset: Int = 0) {
        playback.playUris(uris: uris, offset: offset)
    }

    func refreshPlaybackState() async {
        await playback.refreshPlaybackState()
        if let error = playback.errorMessage {
            appError = error
            playback.errorMessage = nil
        }
    }

    // MARK: - Search Handlers

    func performSearch(query: String) {
        searchDebounceTask?.cancel()

        let trimmedQuery = query.trimmingCharacters(in: .whitespaces)
        guard !trimmedQuery.isEmpty else {
            searchResults = nil
            isSearching = false
            return
        }

        isSearching = true

        searchDebounceTask = Task {
            do {
                try await Task.sleep(nanoseconds: UInt64(searchDebounceInterval * 1_000_000_000))
                guard !Task.isCancelled else { return }

                let results = try await spotifyService.search(
                    query: trimmedQuery,
                    types: ["track", "album", "artist", "playlist"],
                    limit: 20
                )

                guard !Task.isCancelled else { return }
                searchResults = results
                isSearching = false
            } catch {
                guard !Task.isCancelled else { return }
                appError = error.localizedDescription
                isSearching = false
            }
        }
    }

    func clearSearch() {
        searchDebounceTask?.cancel()
        searchResults = nil
        isSearching = false
    }

    // MARK: - Navigation Handlers (Delegation)

    func navigate(to view: AppView) {
        navigation.navigate(to: view)
    }

    func goBack() {
        navigation.goBack()
    }

    // MARK: - Device Handlers (Delegation)

    func refreshDevices() {
        devices.refreshDevices()
        if let error = devices.error {
            appError = error.localizedDescription
        }
    }

    func transferPlayback(to deviceId: String) {
        devices.transferPlayback(to: deviceId)
        if let error = devices.error {
            appError = error.localizedDescription
        }
    }

// MARK: - Preview Mode

    func populateMockData() {
        auth.isAuthed = true
        populateMockUserProfile()
        let track = createMockTrack()
        populateMockPlayback(with: track)
        populateMockArtistDetail()
        populateMockPlaylists()
        navigation.currentView = .home
    }

    private func populateMockUserProfile() {
        auth.userProfile = SpotifyUserProfile(
            id: "user123",
            displayName: "Alex",
            images: [SpotifyImage(
                url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop",
                height: 150,
                width: 150
            )],
            email: "alex@example.com",
            country: "US",
            product: "premium",
            followers: Followers(total: 42, href: nil),
            externalUrls: nil,
            href: nil,
            uri: "spotify:user:user123",
            explicitContent: nil
        )
    }

    private func createMockArtists() -> [SpotifyArtist] {
        [
            SpotifyArtist(
                id: "artist123",
                name: "Mr. Scruff",
                genres: nil,
                followers: nil,
                images: [SpotifyImage(
                    url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300&h=300&fit=crop",
                    height: 300,
                    width: 300
                )],
                popularity: nil,
                uri: nil
            ),
            SpotifyArtist(
                id: "artist456",
                name: "Feebi",
                genres: nil,
                followers: nil,
                images: nil,
                popularity: nil,
                uri: nil
            )
        ]
    }

    private func createMockAlbum() -> SpotifyAlbum {
        SpotifyAlbum(
            id: "album123",
            name: "Keep It Unreal (10th Anniversary Analogue Remaster Edition)",
            images: [SpotifyImage(
                url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
                height: 300,
                width: 300
            )],
            uri: "spotify:album:album123",
            artists: nil,
            releaseDate: "2009-01-01",
            tracks: nil,
            albumType: "album",
            totalTracks: 12
        )
    }

    private func createMockTrack() -> SpotifyTrack {
        SpotifyTrack(
            id: "track123",
            name: "Honeydew",
            uri: "spotify:track:track123",
            durationMs: 456000,
            artists: createMockArtists(),
            album: createMockAlbum(),
            images: [SpotifyImage(
                url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
                height: 300,
                width: 300
            )],
            trackNumber: 7,
            discNumber: 1,
            explicit: false,
            popularity: 65,
            previewUrl: nil
        )
    }

    private func populateMockPlayback(with track: SpotifyTrack) {
        playback.playbackTrack = track
        playback.lastPlayedTrack = TrackInfo(from: track, progressMs: 410000)
        playback.playbackProgress = 410000
        playback.playbackDuration = 456000
        playback.isPlaying = true
        playback.playbackVolume = 65
        playback.playbackShuffle = false
        playback.playbackRepeat = "off"
        playback.likedTrack = false
        playback.userName = "Lav Baum"
        playback.userImage = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop"
        playback.artistListenCount = 422
        playback.trackListenCount = 7
    }

    private func populateMockArtistDetail() {
        playback.artistDetail = SpotifyArtist(
            id: "artist123",
            name: "Mr. Scruff",
            genres: ["electro swing", "trip hop", "nu jazz", "downtempo", "acid jazz"],
            followers: SpotifyArtist.Followers(total: 175608),
            images: [SpotifyImage(
                url: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300&h=300&fit=crop",
                height: 300,
                width: 300
            )],
            popularity: 72,
            uri: "spotify:artist:artist123"
        )
        contextPanelItem = playback.artistDetail
        playback.tags = ["electro swing", "trip hop", "nu jazz", "downtempo", "acid jazz"]
    }

    private func populateMockPlaylists() {
        playback.playlists = [
            PlaylistItem(
                id: "1",
                name: "Lav Baum",
                image: "https://picsum.photos/seed/lavbaum/300/200"
            ),
            PlaylistItem(
                id: "2",
                name: "Chill Beats",
                image: "https://picsum.photos/seed/chill/300/200"
            ),
            PlaylistItem(
                id: "3",
                name: "Jazz Lounge",
                image: "https://picsum.photos/seed/jazz/300/200"
            ),
            PlaylistItem(
                id: "4",
                name: "Electronic Essentials",
                image: "https://picsum.photos/seed/electronic/300/200"
            )
        ]
    }
}
