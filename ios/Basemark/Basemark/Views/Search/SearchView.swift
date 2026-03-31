import SwiftUI

struct SearchView: View {
    @Environment(AppState.self) private var appState
    @State private var query = ""
    @State private var results: [Document] = []
    @State private var path: [String] = []

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                BasemarkBackground()

                GeometryReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Search")
                                .font(.system(size: 28, weight: .regular, design: .serif))
                                .italic()
                                .foregroundStyle(BasemarkTheme.ink)
                                .padding(.horizontal, 16)

                            BasemarkSearchField(title: "Search notes", text: $query)
                                .padding(.horizontal, 16)

                            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                // No list until you search
                                BasemarkEmptyState(
                                    title: "Search your synced notes",
                                    message: "Start with a title, phrase, or keyword.",
                                    systemImage: "magnifyingglass"
                                )
                            } else if results.isEmpty {
                                BasemarkEmptyState(
                                    title: "No matches",
                                    message: "Try a shorter keyword or sync again.",
                                    systemImage: "doc.text.magnifyingglass"
                                )
                            } else {
                                // Results — no section header, just the list
                                ForEach(results) { document in
                                    NavigationLink(value: document.id) {
                                        DocumentRowView(
                                            document: document,
                                            collectionName: collectionName(for: document.collectionId)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .top)
                        .padding(.top, 4)
                        .padding(.bottom, 24)
                    }
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: String.self) { documentID in
                DocumentReaderView(documentID: documentID)
                    .environment(appState)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    SyncStatusView()
                }
            }
            .task(id: "\(query)-\(appState.reloadToken)") {
                let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.isEmpty {
                    results = []
                } else {
                    results = (try? appState.database.searchDocuments(matching: trimmed)) ?? []
                }
            }
        }
    }

    private func collectionName(for id: String?) -> String? {
        guard let id else { return nil }
        return (try? appState.database.fetchCollections().first(where: { $0.id == id })?.name) ?? nil
    }
}
