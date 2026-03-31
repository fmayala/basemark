import Foundation
import GRDB

struct Document: Codable, FetchableRecord, PersistableRecord, TableRecord, Identifiable, Hashable, Sendable {
    static let databaseTableName = "documents"

    var id: String
    var title: String
    var content: String
    var collectionId: String?
    var isPublic: Bool
    var sortOrder: Double
    var createdAt: Int
    var updatedAt: Int
}
