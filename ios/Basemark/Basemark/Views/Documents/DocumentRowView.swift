import SwiftUI

struct DocumentRowView: View {
    let document: Document
    let collectionName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(document.title.isEmpty ? "Untitled" : document.title)
                .font(.headline)
                .lineLimit(2)

            HStack(spacing: 8) {
                if let collectionName, !collectionName.isEmpty {
                    Label(collectionName, systemImage: "folder")
                } else {
                    Label("Uncategorized", systemImage: "tray")
                }

                Spacer()

                Text(Self.relativeDate(for: document.updatedAt))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private static func relativeDate(for timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        return date.formatted(.relative(presentation: .named))
    }
}
