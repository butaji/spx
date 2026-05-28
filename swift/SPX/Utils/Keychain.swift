import Security
import Foundation

// MARK: - TokenStorageProtocol

/// Protocol for token storage operations
protocol TokenStorageProtocol: Sendable {
    func save(key: String, string: String)
    func read(key: String) -> String?
    func delete(key: String)
    func update(key: String, string: String)
}

// MARK: - KeychainTokenStorage

final class KeychainTokenStorage: TokenStorageProtocol, @unchecked Sendable {

    private let service = "com.spx.spotify"
    private let defaults = UserDefaults.standard

    // Use NSLock for atomic migration check
    private let migrationLock = NSLock()
    private var _hasMigrated = false

    private var hasMigrated: Bool {
        get {
            migrationLock.lock()
            defer { migrationLock.unlock() }
            return _hasMigrated
        }
        set {
            migrationLock.lock()
            defer { migrationLock.unlock() }
            _hasMigrated = newValue
        }
    }

    init() {}

    // MARK: - Migration

    private func migrateFromUserDefaultsIfNeeded() {
        guard !hasMigrated else { return }
        hasMigrated = true

        let keys = ["spotify_access_token", "spotify_refresh_token", "spotify_expires_at"]
        for key in keys {
            if let value = defaults.string(forKey: key) {
                saveToKeychain(value, key: key)
                defaults.removeObject(forKey: key)
            }
        }
    }

    // MARK: - Save

    func save(key: String, string: String) {
        migrateFromUserDefaultsIfNeeded()
        saveToKeychain(string, key: key)
    }

    // MARK: - Read

    func read(key: String) -> String? {
        migrateFromUserDefaultsIfNeeded()
        return readFromKeychain(key: key)
    }

    // MARK: - Delete

    func delete(key: String) {
        migrateFromUserDefaultsIfNeeded()
        deleteFromKeychain(key: key)
    }

    // MARK: - Update

    func update(key: String, string: String) {
        save(key: key, string: string)
    }

    // MARK: - Keychain Operations

    private func saveToKeychain(_ value: String, key: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    private func readFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Mock Token Storage (no keychain prompts)

final class MockTokenStorage: TokenStorageProtocol, @unchecked Sendable {
    private var storage: [String: String] = [:]

    init() {}

    func save(key: String, string: String) {
        storage[key] = string
    }

    func read(key: String) -> String? {
        storage[key]
    }

    func delete(key: String) {
        storage.removeValue(forKey: key)
    }

    func update(key: String, string: String) {
        storage[key] = string
    }

    func reset() {
        storage.removeAll()
    }
}
