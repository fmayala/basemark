import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    enum SyncState: Equatable {
        case idle
        case syncing
        case failed(String)
    }

    private enum StorageKey {
        static let serverURL = "Basemark.serverURL"
    }

    let database: AppDatabase

    var serverConfig: ServerConfig?
    var syncState: SyncState = .idle
    var isAuthenticating = false
    var lastSyncAt: Date?
    var lastErrorMessage: String?
    var reloadToken = 0

    private let apiClient: APIClient
    private let syncEngine: SyncEngine

    var isAuthenticated: Bool {
        serverConfig != nil
    }

    init(
        database: AppDatabase = (try? AppDatabase()) ?? AppDatabase.inMemoryFallback(),
        apiClient: APIClient = APIClient()
    ) {
        self.database = database
        self.apiClient = apiClient
        self.syncEngine = SyncEngine(apiClient: apiClient, database: database)
        restorePersistedSession()
    }

    func signIn(serverURLString: String, token: String) async {
        isAuthenticating = true
        lastErrorMessage = nil
        defer { isAuthenticating = false }

        do {
            let normalizedURL = try ServerConfig.normalizedURL(from: serverURLString)
            let config = ServerConfig(serverURL: normalizedURL, token: token)
            _ = try await apiClient.introspect(config: config)

            try KeychainHelper.saveToken(token, service: KeychainHelper.basemarkService)
            UserDefaults.standard.set(config.serverURL.absoluteString, forKey: StorageKey.serverURL)

            serverConfig = config
            reloadToken += 1
            await performSync()
        } catch {
            lastErrorMessage = AppState.describe(error: error)
        }
    }

    func signOut() {
        serverConfig = nil
        syncState = .idle
        lastErrorMessage = nil
        lastSyncAt = nil
        UserDefaults.standard.removeObject(forKey: StorageKey.serverURL)
        try? KeychainHelper.deleteToken(service: KeychainHelper.basemarkService)
        try? database.resetLocalState()
        reloadToken += 1
    }

    func performSync() async {
        guard let serverConfig else { return }
        guard syncState != .syncing else { return }

        syncState = .syncing
        lastErrorMessage = nil

        do {
            _ = try await syncEngine.performSync(config: serverConfig)
            lastSyncAt = Date()
            syncState = .idle
            reloadToken += 1
        } catch {
            let message = AppState.describe(error: error)
            syncState = .failed(message)
            lastErrorMessage = message
        }
    }

    func refreshIfPossible() async {
        guard isAuthenticated else { return }
        await performSync()
    }

    private func restorePersistedSession() {
        guard
            let urlString = UserDefaults.standard.string(forKey: StorageKey.serverURL),
            let token = try? KeychainHelper.loadToken(service: KeychainHelper.basemarkService),
            !token.isEmpty,
            let url = try? ServerConfig.normalizedURL(from: urlString)
        else {
            return
        }

        serverConfig = ServerConfig(serverURL: url, token: token)
    }

    static func describe(error: Error) -> String {
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? "Unexpected API error."
        }

        return error.localizedDescription
    }
}
