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

extension Document {
    var displayTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled" : title
    }

    var bodyPreview: String {
        let preview = TiptapDocumentCodec.readableText(from: content)
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if preview.count > 180 {
            return String(preview.prefix(177)) + "..."
        }

        return preview
    }
}
