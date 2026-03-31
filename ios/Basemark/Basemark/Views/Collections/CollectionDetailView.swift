import SwiftUI

struct CollectionDetailView: View {
    @Environment(AppState.self) private var appState

    let collection: Collection

    @State private var documents: [Document] = []
    @State private var createdDocumentID: String?
    @State private var isNavigatingToCreated = false
    @State private var createErrorMessage: String?

    var body: some View {
        ZStack {
            BasemarkBackground()

            GeometryReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        // Collection header
                        HStack(alignment: .firstTextBaseline) {
                            if let color = Color(basemarkHex: collection.color) {
                                Circle()
                                    .fill(color)
                                    .frame(width: 8, height: 8)
                            }

                            Text(collection.name)
                                .font(.system(.subheadline, design: .default, weight: .semibold))
                                .foregroundStyle(BasemarkTheme.muted)

                            Spacer(minLength: 8)

                            Text("\(documents.count) notes")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(BasemarkTheme.ghost)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                        if documents.isEmpty {
                            BasemarkEmptyState(
                                title: "This collection is empty",
                                message: "Tap + to create a note, or wait for the next sync.",
                                systemImage: "folder.badge.questionmark"
                            )
                        } else {
                            ForEach(documents) { document in
                                NavigationLink(value: document.id) {
                                    DocumentRowView(document: document, collectionName: collection.name)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .top)
                    .padding(.bottom, 24)
                }
            }
        }
        .navigationTitle(collection.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: String.self) { documentID in
            DocumentReaderView(documentID: documentID)
                .environment(appState)
        }
        .navigationDestination(isPresented: $isNavigatingToCreated) {
            if let createdDocumentID {
                DocumentReaderView(documentID: createdDocumentID)
                    .environment(appState)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    createAndOpenNote()
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(BasemarkTheme.ink)
                }
            }
        }
        .task(id: appState.reloadToken) {
            documents = (try? appState.database.fetchDocuments(inCollectionID: collection.id)) ?? []
        }
        .alert("Couldn't create note", isPresented: createErrorAlertBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(createErrorMessage ?? "Try again.")
        }
    }

    private var createErrorAlertBinding: Binding<Bool> {
        Binding(
            get: { createErrorMessage != nil },
            set: { newValue in
                if !newValue {
                    createErrorMessage = nil
                }
            }
        )
    }

    private func createAndOpenNote() {
        do {
            let localDocumentID = try appState.createLocalDocumentAndSync(collectionID: collection.id)
            createdDocumentID = localDocumentID
            isNavigatingToCreated = true
        } catch {
            createErrorMessage = AppState.describe(error: error)
        }
    }
}
