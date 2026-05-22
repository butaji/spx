import Foundation

class TokenStorage {

    static let shared = TokenStorage()

    private let defaults = UserDefaults.standard

    init() {}

    // MARK: - Save

    func save(key: String, string: String) {
        defaults.set(string, forKey: key)
    }

    // MARK: - Read

    func read(key: String) -> String? {
        return defaults.string(forKey: key)
    }

    // MARK: - Delete

    func delete(key: String) {
        defaults.removeObject(forKey: key)
    }

    // MARK: - Update

    func update(key: String, string: String) {
        defaults.set(string, forKey: key)
    }
}
