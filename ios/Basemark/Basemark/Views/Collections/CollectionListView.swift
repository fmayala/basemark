import SwiftUI

struct CollectionListView: View {
    @Environment(AppState.self) private var appState
    @State private var collections: [Collection] = []
    @State private var documents: [Document] = []

    var body: some View {
        NavigationStack {
            List(collections) { collection in
                NavigationLink {
                    CollectionDetailView(collection: collection)
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(collection.name)
                            .font(.headline)

                        Text("\(documents.filter { $0.collectionId == collection.id }.count) docs")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .overlay {
                if collections.isEmpty {
                    ContentUnavailableView(
                        "No Collections",
                        systemImage: "square.stack.3d.up.slash",
                        description: Text("Collections appear after the first sync.")
                    )
                }
            }
            .navigationTitle("Collections")
            .toolbar {
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
        collections = (try? appState.database.fetchCollections()) ?? []
        documents = (try? appState.database.fetchDocuments()) ?? []
    }
}
