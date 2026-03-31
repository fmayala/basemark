import Foundation
import AuthenticationServices
import Observation
import Combine

@MainActor
@Observable
final class AppState: ObservableObject {
    enum SaveDocumentResult {
        case saved(Document)
        case conflict(Document)
    }

    enum SyncState: Equatable {
        case idle
        case syncing
        case failed(String)
    }

    private enum StorageKey {
        static let serverURL = "Basemark.serverURL"
    }

    /// The default Basemark server. Users no longer enter this manually.
    private static let defaultServerURL = URL(string: "https://basemark.wiki")!

    let database: AppDatabase

    var serverConfig: ServerConfig?
    var syncState: SyncState = .idle
    var isAuthenticating = false
    var lastSyncAt: Date?
    var lastErrorMessage: String?
    var reloadToken = 0
    /// Set by the tab bar's "New" button; DocumentListView observes and navigates.
    var pendingNewNoteID: String?

    private let apiClient: APIClient
    private let syncEngine: SyncEngine
    private let webAuthenticationPresentationContextProvider = WebAuthenticationPresentationContextProvider()
    private var pendingRemoteDocumentCreations: Set<String> = []

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

    /// Authenticates via Google OAuth through the web app's auth flow.
    /// Opens a web-based sign-in session, then exchanges the resulting session for an API token.
    func signInWithGoogle() async {
        isAuthenticating = true
        lastErrorMessage = nil
        defer { isAuthenticating = false }

        let serverURL = Self.defaultServerURL
        let callbackScheme = "basemark"
        let authURL = serverURL.appendingPathComponent("/api/auth/mobile/google")
        var components = URLComponents(url: authURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "callback", value: "\(callbackScheme)://auth")]

        guard let url = components.url else {
            lastErrorMessage = "Could not build the sign-in URL."
            return
        }

        do {
            let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { url, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else if let url {
                        continuation.resume(returning: url)
                    } else {
                        continuation.resume(throwing: APIError.invalidResponse)
                    }
                }
                session.prefersEphemeralWebBrowserSession = false
                session.presentationContextProvider = self.webAuthenticationPresentationContextProvider
                if !session.start() {
                    continuation.resume(throwing: APIError.invalidResponse)
                }
            }

            // Parse the token from the callback URL: basemark://auth?token=...
            guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
                lastErrorMessage = "Sign-in returned an invalid callback URL."
                return
            }

            if let errorCode = components.queryItems?.first(where: { $0.name == "error" })?.value {
                lastErrorMessage = Self.mobileAuthErrorMessage(for: errorCode)
                return
            }

            guard let token = components.queryItems?.first(where: { $0.name == "token" })?.value, !token.isEmpty else {
                lastErrorMessage = "Sign-in succeeded but no token was returned."
                return
            }

            let config = ServerConfig(serverURL: serverURL, token: token)
            _ = try await apiClient.introspect(config: config)

            try KeychainHelper.saveToken(token, service: KeychainHelper.basemarkService)
            UserDefaults.standard.set(serverURL.absoluteString, forKey: StorageKey.serverURL)

            serverConfig = config
            reloadToken += 1
            await performSync()
        } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
            // User cancelled — not an error
        } catch {
            lastErrorMessage = AppState.describe(error: error)
        }
    }

    func signOut() {
        serverConfig = nil
        syncState = .idle
        lastErrorMessage = nil
        lastSyncAt = nil
        pendingNewNoteID = nil
        pendingRemoteDocumentCreations.removeAll()
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
            if Self.isAuthenticationError(error) {
                invalidateSession(message: "Session expired. Sign in again.")
                return
            }

            let message = AppState.describe(error: error)
            syncState = .failed(message)
            lastErrorMessage = message
        }
    }

    func refreshIfPossible() async {
        guard isAuthenticated else { return }
        await performSync()
    }

    func createLocalDocumentAndSync(collectionID: String? = nil) throws -> String {
        guard serverConfig != nil else {
            throw APIError.unauthorized
        }

        let documentID = UUID().uuidString.lowercased()
        let now = Int(Date().timeIntervalSince1970)
        let localDocument = Document(
            id: documentID,
            title: "Untitled",
            content: TiptapDocumentCodec.documentJSONString(fromPlainText: ""),
            collectionId: collectionID,
            isPublic: false,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now
        )

        try database.upsertDocument(localDocument)
        pendingRemoteDocumentCreations.insert(documentID)
        reloadToken += 1

        let draft = DocumentDraft(title: "", bodyText: "", collectionId: collectionID, isPublic: false)
        Task {
            await syncLocalCreatedDocument(documentID: documentID, draft: draft)
        }

        return documentID
    }

    func createDocument(draft: DocumentDraft) async throws -> Document {
        guard let serverConfig else {
            throw APIError.unauthorized
        }

        do {
            let document = try await apiClient.createDocument(config: serverConfig, draft: draft)
            try database.upsertDocument(document)
            reloadToken += 1
            return document
        } catch {
            if Self.isAuthenticationError(error) {
                invalidateSession(message: "Session expired. Sign in again.")
            }

            throw error
        }
    }

    func saveDocument(documentID: String, draft: DocumentDraft, baseUpdatedAt: Int) async throws -> SaveDocumentResult {
        guard let serverConfig else {
            throw APIError.unauthorized
        }

        do {
            let document = try await apiClient.updateDocument(
                config: serverConfig,
                documentID: documentID,
                draft: draft,
                baseUpdatedAt: baseUpdatedAt
            )
            try database.upsertDocument(document)
            pendingRemoteDocumentCreations.remove(documentID)
            reloadToken += 1
            return .saved(document)
        } catch APIError.conflict(let document) {
            if let document {
                try? database.upsertDocument(document)
                reloadToken += 1
                return .conflict(document)
            }

            throw APIError.conflict(nil)
        } catch APIError.server(let statusCode, _) where statusCode == 404 {
            do {
                // If this note was created locally moments ago, allow the background create task
                // one chance to finish before we fall back to explicit create.
                if pendingRemoteDocumentCreations.contains(documentID) {
                    try await Task.sleep(for: .milliseconds(300))

                    let retriedDocument = try await apiClient.updateDocument(
                        config: serverConfig,
                        documentID: documentID,
                        draft: draft,
                        baseUpdatedAt: baseUpdatedAt
                    )
                    try database.upsertDocument(retriedDocument)
                    pendingRemoteDocumentCreations.remove(documentID)
                    reloadToken += 1
                    return .saved(retriedDocument)
                }
            } catch APIError.server(let retryStatus, _) where retryStatus == 404 {
                // Still not present on server; create below.
            } catch {
                if Self.isAuthenticationError(error) {
                    invalidateSession(message: "Session expired. Sign in again.")
                }
                throw error
            }

            do {
                let createdDocument = try await apiClient.createDocument(
                    config: serverConfig,
                    draft: draft,
                    preferredID: documentID
                )
                try database.upsertDocument(createdDocument)
                pendingRemoteDocumentCreations.remove(documentID)
                reloadToken += 1
                return .saved(createdDocument)
            } catch {
                if Self.isAuthenticationError(error) {
                    invalidateSession(message: "Session expired. Sign in again.")
                }
                throw error
            }
        } catch {
            if Self.isAuthenticationError(error) {
                invalidateSession(message: "Session expired. Sign in again.")
            }

            throw error
        }
    }

    func deleteDocument(id: String) async throws {
        guard let serverConfig else {
            throw APIError.unauthorized
        }

        let wasPendingRemoteCreate = pendingRemoteDocumentCreations.contains(id)
        pendingRemoteDocumentCreations.remove(id)

        do {
            try await apiClient.deleteDocument(config: serverConfig, documentID: id)
            try database.deleteDocument(id: id)
            reloadToken += 1
        } catch APIError.server(let statusCode, _) where statusCode == 404 && wasPendingRemoteCreate {
            // Locally-created note was deleted before its remote create completed.
            try database.deleteDocument(id: id)
            reloadToken += 1
        } catch {
            if Self.isAuthenticationError(error) {
                invalidateSession(message: "Session expired. Sign in again.")
            }

            throw error
        }
    }

    private func syncLocalCreatedDocument(documentID: String, draft: DocumentDraft) async {
        guard pendingRemoteDocumentCreations.contains(documentID) else { return }
        guard let serverConfig else { return }

        do {
            let document = try await apiClient.createDocument(
                config: serverConfig,
                draft: draft,
                preferredID: documentID
            )

            guard pendingRemoteDocumentCreations.contains(documentID) else { return }
            try database.upsertDocument(document)
            pendingRemoteDocumentCreations.remove(documentID)
            reloadToken += 1
        } catch {
            // Keep the local note available; save() will retry creation when needed.
            if Self.isAuthenticationError(error) {
                invalidateSession(message: "Session expired. Sign in again.")
                return
            }

            guard pendingRemoteDocumentCreations.contains(documentID) else { return }
        }
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

    private func invalidateSession(message: String) {
        serverConfig = nil
        syncState = .idle
        lastSyncAt = nil
        lastErrorMessage = message
        pendingNewNoteID = nil
        pendingRemoteDocumentCreations.removeAll()
        UserDefaults.standard.removeObject(forKey: StorageKey.serverURL)
        try? KeychainHelper.deleteToken(service: KeychainHelper.basemarkService)
        reloadToken += 1
    }

    private static func isAuthenticationError(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else {
            return false
        }

        switch apiError {
        case .unauthorized, .forbidden:
            return true
        default:
            return false
        }
    }

    private static func mobileAuthErrorMessage(for code: String) -> String {
        switch code {
        case "forbidden":
            return "Only the workspace owner can sign in."
        case "unauthorized":
            return "Google sign-in did not complete."
        case "server_error":
            return "Basemark could not create a mobile session token."
        default:
            return "Google sign-in failed."
        }
    }
}
