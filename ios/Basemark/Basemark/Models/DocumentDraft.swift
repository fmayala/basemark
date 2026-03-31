import Foundation

struct DocumentDraft: Equatable, Sendable {
    var title: String
    var bodyText: String
    var collectionId: String?
    var isPublic: Bool

    init(
        title: String = "",
        bodyText: String = "",
        collectionId: String? = nil,
        isPublic: Bool = false
    ) {
        self.title = title
        self.bodyText = bodyText
        self.collectionId = collectionId
        self.isPublic = isPublic
    }

    init(document: Document) {
        title = document.title
        bodyText = TiptapDocumentCodec.editableText(from: document.content)
        collectionId = document.collectionId
        isPublic = document.isPublic
    }

    var normalizedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var normalizedBodyText: String {
        bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var encodedContent: String {
        TiptapDocumentCodec.documentJSONString(fromPlainText: bodyText)
    }

    var isMeaningfullyEmpty: Bool {
        normalizedTitle.isEmpty && normalizedBodyText.isEmpty
    }
}
