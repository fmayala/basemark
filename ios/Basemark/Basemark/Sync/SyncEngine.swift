import Foundation

actor SyncEngine {
    struct Summary: Sendable {
        var documents: Int
        var collections: Int
        var deletions: Int
        var cursor: Int?
    }

    private let apiClient: APIClient
    private let database: AppDatabase

    init(apiClient: APIClient, database: AppDatabase) {
        self.apiClient = apiClient
        self.database = database
    }

    func performSync(config: ServerConfig) async throws -> Summary {
        var cursor = try database.currentSyncCursor()
        var totalDocuments = 0
        var totalCollections = 0
        var totalDeletions = 0

        while true {
            let response = try await apiClient.fetchChanges(config: config, cursor: cursor)
            try database.applySyncResponse(response)

            totalDocuments += response.documents.count
            totalCollections += response.collections.count
            totalDeletions += response.deletions.count
            cursor = response.cursor

            if !response.hasMore {
                break
            }
        }

        return Summary(
            documents: totalDocuments,
            collections: totalCollections,
            deletions: totalDeletions,
            cursor: cursor
        )
    }
}
