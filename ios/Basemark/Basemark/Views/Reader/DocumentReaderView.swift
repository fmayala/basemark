import SwiftUI

struct DocumentReaderView: View {
    @Environment(AppState.self) private var appState

    let documentID: String

    @State private var document: Document?

    var body: some View {
        Group {
            if let document {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Text(document.title.isEmpty ? "Untitled" : document.title)
                            .font(.largeTitle.weight(.semibold))

                        HStack(spacing: 12) {
                            Label(Self.absoluteDate(for: document.updatedAt), systemImage: "clock")
                            if document.isPublic {
                                Label("Public", systemImage: "globe")
                            }
                        }
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                        Divider()

                        TiptapRenderer(content: document.content)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
                .background(Color(.systemGroupedBackground))
            } else {
                ContentUnavailableView(
                    "Document Unavailable",
                    systemImage: "doc.questionmark",
                    description: Text("This document is no longer in the local cache.")
                )
            }
        }
        .navigationTitle(document?.title ?? "Reader")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(documentID)-\(appState.reloadToken)") {
            document = try? appState.database.fetchDocument(id: documentID)
        }
    }

    private static func absoluteDate(for timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
