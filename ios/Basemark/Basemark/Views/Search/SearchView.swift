import SwiftUI

struct SearchView: View {
    @Environment(AppState.self) private var appState
    @State private var query = ""
    @State private var results: [Document] = []

    var body: some View {
        NavigationStack {
            List(results) { document in
                NavigationLink(value: document.id) {
                    DocumentRowView(document: document, collectionName: nil)
                }
            }
            .overlay {
                if results.isEmpty {
                    ContentUnavailableView(
                        query.isEmpty ? "Search Your Cache" : "No Matches",
                        systemImage: query.isEmpty ? "magnifyingglass" : "doc.text.magnifyingglass",
                        description: Text(query.isEmpty ? "Search titles and document content after your first sync." : "Try a shorter keyword.")
                    )
                }
            }
            .navigationTitle("Search")
            .navigationDestination(for: String.self) { documentID in
                DocumentReaderView(documentID: documentID)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    SyncStatusView()
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
            .task(id: "\(query)-\(appState.reloadToken)") {
                results = (try? appState.database.searchDocuments(matching: query)) ?? []
            }
        }
    }
}
