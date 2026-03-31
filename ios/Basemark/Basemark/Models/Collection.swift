import Foundation
import GRDB

struct Collection: Codable, FetchableRecord, PersistableRecord, TableRecord, Identifiable, Hashable, Sendable {
    static let databaseTableName = "collections"

    var id: String
    var name: String
    var icon: String?
    var color: String?
    var sortOrder: Double
    var createdAt: Int
    var updatedAt: Int
}
