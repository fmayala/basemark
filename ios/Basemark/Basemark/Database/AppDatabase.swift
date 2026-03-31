import Foundation
import GRDB

final class AppDatabase: @unchecked Sendable {
    private enum Constants {
        static let syncCursorKey = "changes"
    }

    let dbPool: DatabasePool

    init(path: String? = nil) throws {
        let configuration = Configuration()
        let finalPath = path ?? Self.defaultDatabasePath()
        try FileManager.default.createDirectory(
            at: URL(fileURLWithPath: finalPath).deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        dbPool = try DatabasePool(path: finalPath, configuration: configuration)
        try Self.makeMigrator().migrate(dbPool)
    }

    static func inMemoryFallback() -> AppDatabase {
        do {
            return try AppDatabase(path: ":memory:")
        } catch {
            fatalError("Failed to create in-memory database: \(error)")
        }
    }

    func fetchDocuments() throws -> [Document] {
        try dbPool.read { db in
            try Document
                .order(Column("updatedAt").desc, Column("sortOrder").asc)
                .fetchAll(db)
        }
    }

    func fetchRecentDocuments(limit: Int = 12) throws -> [Document] {
        try dbPool.read { db in
            try Document
                .order(Column("updatedAt").desc)
                .limit(limit)
                .fetchAll(db)
        }
    }

    func fetchDocument(id: String) throws -> Document? {
        try dbPool.read { db in
            try Document.fetchOne(db, key: id)
        }
    }

    func fetchCollections() throws -> [Collection] {
        try dbPool.read { db in
            try Collection
                .order(Column("sortOrder").asc, Column("updatedAt").desc)
                .fetchAll(db)
        }
    }

    func fetchDocuments(inCollectionID collectionID: String) throws -> [Document] {
        try dbPool.read { db in
            try Document
                .filter(Column("collectionId") == collectionID)
                .order(Column("sortOrder").asc, Column("updatedAt").desc)
                .fetchAll(db)
        }
    }

    func searchDocuments(matching query: String) throws -> [Document] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return try fetchRecentDocuments() }

        return try dbPool.read { db in
            let ftsQuery = "\"\(trimmed.replacingOccurrences(of: "\"", with: ""))\"*"
            let sql = """
                SELECT d.*
                FROM documents AS d
                JOIN documents_fts AS f ON f.doc_id = d.id
                WHERE documents_fts MATCH ?
                ORDER BY bm25(documents_fts), d.updatedAt DESC
                LIMIT 50
                """

            do {
                return try Document.fetchAll(db, sql: sql, arguments: [ftsQuery])
            } catch {
                let fallbackPattern = "%\(trimmed)%"
                return try Document
                    .filter(sql: "title LIKE ? OR content LIKE ?", arguments: [fallbackPattern, fallbackPattern])
                    .order(Column("updatedAt").desc)
                    .limit(50)
                    .fetchAll(db)
            }
        }
    }

    func currentSyncCursor() throws -> Int? {
        try dbPool.read { db in
            try Int.fetchOne(
                db,
                sql: "SELECT value FROM sync_cursors WHERE key = ?",
                arguments: [Constants.syncCursorKey]
            )
        }
    }

    func applySyncResponse(_ response: SyncResponse) throws {
        try dbPool.write { db in
            for collection in response.collections {
                try db.execute(
                    sql: """
                        INSERT INTO collections (
                            id, name, icon, color, sortOrder, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            name = excluded.name,
                            icon = excluded.icon,
                            color = excluded.color,
                            sortOrder = excluded.sortOrder,
                            createdAt = excluded.createdAt,
                            updatedAt = excluded.updatedAt
                        """,
                    arguments: [
                        collection.id,
                        collection.name,
                        collection.icon,
                        collection.color,
                        collection.sortOrder,
                        collection.createdAt,
                        collection.updatedAt,
                    ]
                )
            }

            for document in response.documents {
                try db.execute(
                    sql: """
                        INSERT INTO documents (
                            id, title, content, collectionId, isPublic, sortOrder, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            content = excluded.content,
                            collectionId = excluded.collectionId,
                            isPublic = excluded.isPublic,
                            sortOrder = excluded.sortOrder,
                            createdAt = excluded.createdAt,
                            updatedAt = excluded.updatedAt
                        """,
                    arguments: [
                        document.id,
                        document.title,
                        document.content,
                        document.collectionId,
                        document.isPublic,
                        document.sortOrder,
                        document.createdAt,
                        document.updatedAt,
                    ]
                )

                try db.execute(
                    sql: "DELETE FROM documents_fts WHERE doc_id = ?",
                    arguments: [document.id]
                )
                try db.execute(
                    sql: "INSERT INTO documents_fts (doc_id, title, body) VALUES (?, ?, ?)",
                    arguments: [document.id, document.title, Self.searchableText(from: document.content)]
                )
            }

            for deletion in response.deletions {
                switch deletion.entityType {
                case "document":
                    try db.execute(sql: "DELETE FROM documents_fts WHERE doc_id = ?", arguments: [deletion.entityId])
                    try db.execute(sql: "DELETE FROM documents WHERE id = ?", arguments: [deletion.entityId])
                case "collection":
                    try db.execute(sql: "DELETE FROM collections WHERE id = ?", arguments: [deletion.entityId])
                default:
                    continue
                }
            }

            try db.execute(
                sql: """
                    INSERT INTO sync_cursors (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    """,
                arguments: [Constants.syncCursorKey, response.cursor]
            )
        }
    }

    func resetLocalState() throws {
        try dbPool.write { db in
            try db.execute(sql: "DELETE FROM documents_fts")
            try db.execute(sql: "DELETE FROM documents")
            try db.execute(sql: "DELETE FROM collections")
            try db.execute(sql: "DELETE FROM sync_cursors")
        }
    }

    private static func makeMigrator() -> DatabaseMigrator {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1") { db in
            try db.create(table: "collections") { table in
                table.column("id", .text).primaryKey()
                table.column("name", .text).notNull()
                table.column("icon", .text)
                table.column("color", .text)
                table.column("sortOrder", .double).notNull()
                table.column("createdAt", .integer).notNull()
                table.column("updatedAt", .integer).notNull()
            }

            try db.create(table: "documents") { table in
                table.column("id", .text).primaryKey()
                table.column("title", .text).notNull()
                table.column("content", .text).notNull()
                table.column("collectionId", .text)
                    .references("collections", onDelete: .setNull)
                table.column("isPublic", .boolean).notNull()
                table.column("sortOrder", .double).notNull()
                table.column("createdAt", .integer).notNull()
                table.column("updatedAt", .integer).notNull()
            }

            try db.create(table: "sync_cursors") { table in
                table.column("key", .text).primaryKey()
                table.column("value", .integer).notNull()
            }

            try db.create(virtualTable: "documents_fts", using: FTS5()) { table in
                table.column("doc_id").notIndexed()
                table.column("title")
                table.column("body")
            }
        }

        return migrator
    }

    private static func defaultDatabasePath() -> String {
        let applicationSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return applicationSupportURL
            .appendingPathComponent("Basemark", isDirectory: true)
            .appendingPathComponent("basemark.sqlite")
            .path
    }

    private static func searchableText(from content: String) -> String {
        guard
            let data = content.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data)
        else {
            return content
        }

        var pieces: [String] = []

        func walk(_ value: Any) {
            switch value {
            case let text as String:
                pieces.append(text)
            case let array as [Any]:
                array.forEach(walk)
            case let dictionary as [String: Any]:
                dictionary.values.forEach(walk)
            default:
                break
            }
        }

        walk(object)
        return pieces.joined(separator: " ")
    }
}
