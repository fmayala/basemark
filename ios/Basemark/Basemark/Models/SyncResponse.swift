import Foundation

struct SyncResponse: Codable, Sendable {
    struct Deletion: Codable, Hashable, Sendable {
        var entityType: String
        var entityId: String
        var deletedAt: Int
    }

    var documents: [Document]
    var collections: [Collection]
    var deletions: [Deletion]
    var cursor: Int
    var hasMore: Bool
}
