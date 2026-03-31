import SwiftUI

struct CollectionDetailView: View {
    @Environment(AppState.self) private var appState

    let collection: Collection

    @State private var documents: [Document] = []

    var body: some View {
        List(documents) { document in
            NavigationLink(value: document.id) {
                DocumentRowView(document: document, collectionName: collection.name)
            }
        }
        .overlay {
            if documents.isEmpty {
                ContentUnavailableView(
                    "No Documents",
                    systemImage: "folder.badge.questionmark",
                    description: Text("This collection is empty in the local cache.")
                )
            }
        }
        .navigationTitle(collection.name)
        .navigationDestination(for: String.self) { documentID in
            DocumentReaderView(documentID: documentID)
        }
        .task(id: appState.reloadToken) {
            documents = (try? appState.database.fetchDocuments(inCollectionID: collection.id)) ?? []
        }
    }
}
