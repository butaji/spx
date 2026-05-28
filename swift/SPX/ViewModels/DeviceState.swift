import Foundation
import SwiftUI

// MARK: - DeviceState

@MainActor
@Observable
final class DeviceState {

    // MARK: - Properties

    var localDevices: [LocalDevice] = []
    var spotifyDevices: [SpotifyDevice] = []
    var error: Error?

    // MARK: - Private

    private let spotifyService: SpotifyServiceProtocol

    // MARK: - Init

    init(spotifyService: SpotifyServiceProtocol) {
        self.spotifyService = spotifyService
    }

    // MARK: - Devices

    func refreshDevices() {
        Task {
            do {
                async let local = spotifyService.getLocalDevices()
                async let spotify = spotifyService.getDevices()

                localDevices = try await local
                spotifyDevices = try await spotify
                error = nil
            } catch {
                self.error = error
            }
        }
    }

    func transferPlayback(to deviceId: String) {
        Task {
            do {
                try await spotifyService.transferPlayback(to: deviceId)
                error = nil
            } catch {
                self.error = error
            }
        }
    }
}
