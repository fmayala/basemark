import SwiftUI

struct DocumentListView: View {
    @Environment(AppState.self) private var appState
    @State private var documents: [Document] = []
    @State private var collections: [Collection] = []

    var body: some View {
        NavigationStack {
            List {
                if documents.isEmpty {
                    ContentUnavailableView(
                        "No Documents",
                        systemImage: "doc.text",
                        description: Text("Pull to sync from your Basemark server.")
                    )
                } else {
                    Section("Recent") {
                        ForEach(Array(documents.prefix(12))) { document in
                            NavigationLink(value: document.id) {
                                DocumentRowView(
                                    document: document,
                                    collectionName: collections.first(where: { $0.id == document.collectionId })?.name
                                )
                            }
                        }
                    }

                    ForEach(collections) { collection in
                        let scoped = documents
                            .filter { $0.collectionId == collection.id }
                            .sorted { lhs, rhs in
                                if lhs.sortOrder == rhs.sortOrder {
                                    return lhs.updatedAt > rhs.updatedAt
                                }

                                return lhs.sortOrder < rhs.sortOrder
                            }

                        if !scoped.isEmpty {
                            Section(collection.name) {
                                ForEach(scoped) { document in
                                    NavigationLink(value: document.id) {
                                        DocumentRowView(document: document, collectionName: collection.name)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Documents")
            .navigationDestination(for: String.self) { documentID in
                DocumentReaderView(documentID: documentID)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Sign Out", role: .destructive) {
                        appState.signOut()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    SyncStatusView()
                }
            }
            .task(id: appState.reloadToken) {
                load()
            }
            .refreshable {
                await appState.performSync()
                load()
            }
        }
    }

    private func load() {
        documents = (try? appState.database.fetchDocuments()) ?? []
        collections = (try? appState.database.fetchCollections()) ?? []
    }
}
