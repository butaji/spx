import XCTest
@testable import SPX

final class AppViewTests: XCTestCase {

    // MARK: - Enum Creation and Equality Tests

    func testHomeViewCreation() {
        let view = AppView.home
        if case .home = view {
            // Success
        } else {
            XCTFail("Expected .home case")
        }
    }

    func testSearchViewCreation() {
        let view = AppView.search
        if case .search = view {
            // Success
        } else {
            XCTFail("Expected .search case")
        }
    }

    func testQueueViewCreation() {
        let view = AppView.queue
        if case .queue = view {
            // Success
        } else {
            XCTFail("Expected .queue case")
        }
    }

    func testLibraryViewCreation() {
        let nilLibrary = AppView.library(tab: nil)
        let playlistsLibrary = AppView.library(tab: "playlists")
        let artistsLibrary = AppView.library(tab: "artists")

        if case .library(let tab) = nilLibrary {
            XCTAssertNil(tab)
        } else {
            XCTFail("Expected .library(nil) case")
        }

        if case .library(let tab) = playlistsLibrary {
            XCTAssertEqual(tab, "playlists")
        } else {
            XCTFail("Expected .library(tab: 'playlists') case")
        }

        if case .library(let tab) = artistsLibrary {
            XCTAssertEqual(tab, "artists")
        } else {
            XCTFail("Expected .library(tab: 'artists') case")
        }
    }

    func testPlaylistViewCreation() {
        let view = AppView.playlist(id: "playlist123", name: "My Playlist")

        if case .playlist(let id, let name) = view {
            XCTAssertEqual(id, "playlist123")
            XCTAssertEqual(name, "My Playlist")
        } else {
            XCTFail("Expected .playlist case")
        }
    }

    func testAlbumViewCreation() {
        let view = AppView.album(id: "album456", name: "Great Album")

        if case .album(let id, let name) = view {
            XCTAssertEqual(id, "album456")
            XCTAssertEqual(name, "Great Album")
        } else {
            XCTFail("Expected .album case")
        }
    }

    func testArtistViewCreation() {
        let view = AppView.artist(id: "artist789", name: "Amazing Artist")

        if case .artist(let id, let name) = view {
            XCTAssertEqual(id, "artist789")
            XCTAssertEqual(name, "Amazing Artist")
        } else {
            XCTFail("Expected .artist case")
        }
    }

    // MARK: - Equality Tests

    func testHomeEquality() {
        let view1 = AppView.home
        let view2 = AppView.home

        XCTAssertEqual(view1, view2)
    }

    func testSearchEquality() {
        let view1 = AppView.search
        let view2 = AppView.search

        XCTAssertEqual(view1, view2)
    }

    func testQueueEquality() {
        let view1 = AppView.queue
        let view2 = AppView.queue

        XCTAssertEqual(view1, view2)
    }

    func testLibraryEquality() {
        let view1 = AppView.library(tab: nil)
        let view2 = AppView.library(tab: nil)
        let view3 = AppView.library(tab: "playlists")
        let view4 = AppView.library(tab: "playlists")
        let view5 = AppView.library(tab: "artists")

        XCTAssertEqual(view1, view2)
        XCTAssertEqual(view3, view4)
        XCTAssertNotEqual(view1, view3)
        XCTAssertNotEqual(view3, view5)
    }

    func testPlaylistEquality() {
        let view1 = AppView.playlist(id: "123", name: "Playlist A")
        let view2 = AppView.playlist(id: "123", name: "Playlist A")
        let view3 = AppView.playlist(id: "456", name: "Playlist A")
        let view4 = AppView.playlist(id: "123", name: "Playlist B")

        XCTAssertEqual(view1, view2)
        XCTAssertNotEqual(view1, view3)
        XCTAssertNotEqual(view1, view4)
        XCTAssertNotEqual(view3, view4)
    }

    func testAlbumEquality() {
        let view1 = AppView.album(id: "album1", name: "Album X")
        let view2 = AppView.album(id: "album1", name: "Album X")
        let view3 = AppView.album(id: "album2", name: "Album X")
        let view4 = AppView.album(id: "album1", name: "Album Y")

        XCTAssertEqual(view1, view2)
        XCTAssertNotEqual(view1, view3)
        XCTAssertNotEqual(view1, view4)
    }

    func testArtistEquality() {
        let view1 = AppView.artist(id: "artist1", name: "Artist One")
        let view2 = AppView.artist(id: "artist1", name: "Artist One")
        let view3 = AppView.artist(id: "artist2", name: "Artist One")
        let view4 = AppView.artist(id: "artist1", name: "Artist Two")

        XCTAssertEqual(view1, view2)
        XCTAssertNotEqual(view1, view3)
        XCTAssertNotEqual(view1, view4)
    }

    func testInequalityBetweenViewTypes() {
        let home = AppView.home
        let search = AppView.search
        let queue = AppView.queue
        let library = AppView.library(tab: nil)
        let playlist = AppView.playlist(id: "p1", name: "P")
        let album = AppView.album(id: "a1", name: "A")
        let artist = AppView.artist(id: "ar1", name: "Ar")

        XCTAssertNotEqual(home, search)
        XCTAssertNotEqual(home, queue)
        XCTAssertNotEqual(home, library)
        XCTAssertNotEqual(home, playlist)
        XCTAssertNotEqual(home, album)
        XCTAssertNotEqual(home, artist)

        XCTAssertNotEqual(search, queue)
        XCTAssertNotEqual(search, library)
        XCTAssertNotEqual(search, playlist)

        XCTAssertNotEqual(queue, library)
        XCTAssertNotEqual(queue, album)
    }

    // MARK: - Hashable Conformance Tests

    func testHashableConformance() {
        let view1 = AppView.home
        let view2 = AppView.home

        XCTAssertEqual(view1.hashValue, view2.hashValue)
    }

    func testHashableWithDifferentCases() {
        let home = AppView.home
        let search = AppView.search

        XCTAssertNotEqual(home.hashValue, search.hashValue)
    }

    func testHashableLibraryWithDifferentTabs() {
        let lib1 = AppView.library(tab: nil)
        let lib2 = AppView.library(tab: "playlists")
        let lib3 = AppView.library(tab: "playlists")

        XCTAssertNotEqual(lib1.hashValue, lib2.hashValue)
        XCTAssertEqual(lib2.hashValue, lib3.hashValue)
    }

    func testHashablePlaylistWithDifferentIds() {
        let playlist1 = AppView.playlist(id: "id1", name: "Same Name")
        let playlist2 = AppView.playlist(id: "id2", name: "Same Name")
        let playlist3 = AppView.playlist(id: "id1", name: "Same Name")

        XCTAssertNotEqual(playlist1.hashValue, playlist2.hashValue)
        XCTAssertEqual(playlist1.hashValue, playlist3.hashValue)
    }

    func testHashableAlbumWithDifferentNames() {
        let album1 = AppView.album(id: "sameId", name: "Album A")
        let album2 = AppView.album(id: "sameId", name: "Album B")
        let album3 = AppView.album(id: "sameId", name: "Album A")

        XCTAssertNotEqual(album1.hashValue, album2.hashValue)
        XCTAssertEqual(album1.hashValue, album3.hashValue)
    }

    func testHashableArtistWithDifferentIds() {
        let artist1 = AppView.artist(id: "idA", name: "Same Name")
        let artist2 = AppView.artist(id: "idB", name: "Same Name")
        let artist3 = AppView.artist(id: "idA", name: "Same Name")

        XCTAssertNotEqual(artist1.hashValue, artist2.hashValue)
        XCTAssertEqual(artist1.hashValue, artist3.hashValue)
    }

    func testHashSetWithAppView() {
        var hashSet = Set<AppView>()

        hashSet.insert(AppView.home)
        hashSet.insert(AppView.search)
        hashSet.insert(AppView.queue)
        hashSet.insert(AppView.library(tab: nil))
        hashSet.insert(AppView.library(tab: "playlists"))
        hashSet.insert(AppView.playlist(id: "p1", name: "Playlist"))
        hashSet.insert(AppView.album(id: "a1", name: "Album"))
        hashSet.insert(AppView.artist(id: "ar1", name: "Artist"))

        // Insert duplicates
        hashSet.insert(AppView.home)
        hashSet.insert(AppView.library(tab: "playlists"))
        hashSet.insert(AppView.playlist(id: "p1", name: "Playlist"))

        XCTAssertEqual(hashSet.count, 8)
    }

    // MARK: - Associated Values Tests

    func testLibraryAssociatedValueAccess() {
        let views: [AppView] = [
            .library(tab: nil),
            .library(tab: "playlists"),
            .library(tab: "artists"),
            .library(tab: "albums")
        ]

        XCTAssertNil(views[0].libraryTab)
        XCTAssertEqual(views[1].libraryTab, "playlists")
        XCTAssertEqual(views[2].libraryTab, "artists")
        XCTAssertEqual(views[3].libraryTab, "albums")
    }

    func testPlaylistAssociatedValueAccess() {
        let view = AppView.playlist(id: "testId", name: "Test Name")

        XCTAssertEqual(view.playlistId, "testId")
        XCTAssertEqual(view.playlistName, "Test Name")
    }

    func testAlbumAssociatedValueAccess() {
        let view = AppView.album(id: "albumId", name: "Album Name")

        XCTAssertEqual(view.albumId, "albumId")
        XCTAssertEqual(view.albumName, "Album Name")
    }

    func testArtistAssociatedValueAccess() {
        let view = AppView.artist(id: "artistId", name: "Artist Name")

        XCTAssertEqual(view.artistId, "artistId")
        XCTAssertEqual(view.artistName, "Artist Name")
    }

    func testNoAssociatedValueCases() {
        let home = AppView.home
        let search = AppView.search
        let queue = AppView.queue

        XCTAssertNil(home.libraryTab)
        XCTAssertNil(home.playlistId)
        XCTAssertNil(home.albumId)
        XCTAssertNil(home.artistId)

        XCTAssertNil(search.libraryTab)
        XCTAssertNil(search.playlistId)

        XCTAssertNil(queue.libraryTab)
        XCTAssertNil(queue.albumId)
    }
}

// MARK: - AppView Helper Extensions

extension AppView {
    var libraryTab: String? {
        if case .library(let tab) = self {
            return tab
        }
        return nil
    }

    var playlistId: String? {
        if case .playlist(let id, _) = self {
            return id
        }
        return nil
    }

    var playlistName: String? {
        if case .playlist(_, let name) = self {
            return name
        }
        return nil
    }

    var albumId: String? {
        if case .album(let id, _) = self {
            return id
        }
        return nil
    }

    var albumName: String? {
        if case .album(_, let name) = self {
            return name
        }
        return nil
    }

    var artistId: String? {
        if case .artist(let id, _) = self {
            return id
        }
        return nil
    }

    var artistName: String? {
        if case .artist(_, let name) = self {
            return name
        }
        return nil
    }
}
