import SwiftUI

struct DocumentListView: View {
    @Environment(AppState.self) private var appState
    @State private var documents: [Document] = []
    @State private var collections: [Collection] = []
    @State private var path: [String] = []
    @State private var searchQuery = ""

    private var isSearching: Bool {
        !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var searchResults: [Document] {
        let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        return (try? appState.database.searchDocuments(matching: trimmed)) ?? []
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                BasemarkBackground()

                GeometryReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            header

                            if isSearching {
                                searchContent
                            } else {
                                libraryContent
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .top)
                        .padding(.top, 12)
                        .padding(.bottom, 24)
                    }
                    .refreshable {
                        await appState.performSync()
                        load()
                    }
                }
            }
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: String.self) { documentID in
                DocumentReaderView(documentID: documentID)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    SyncStatusView()
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            Task {
                                await appState.performSync()
                                load()
                            }
                        } label: {
                            Label("Sync now", systemImage: "arrow.clockwise")
                        }

                        Button(role: .destructive) {
                            appState.signOut()
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(BasemarkTheme.ink)
                    }
                }
            }
            .task(id: appState.reloadToken) {
                load()
            }
            .onChange(of: appState.pendingNewNoteID) { _, newID in
                guard let newID else { return }
                appState.pendingNewNoteID = nil
                path = [newID]
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            BasemarkSectionHeader(
                eyebrow: "Library",
                title: "Notes",
                detail: "\(documents.count) synced"
            )
            .padding(.horizontal, 16)

            BasemarkSearchField(title: "Search notes", text: $searchQuery)
                .padding(.horizontal, 16)
        }
    }

    // MARK: - Search results

    @ViewBuilder
    private var searchContent: some View {
        let results = searchResults
        if results.isEmpty {
            BasemarkEmptyState(
                title: "No matches",
                message: "Try a shorter keyword or sync again.",
                systemImage: "doc.text.magnifyingglass"
            )
        } else {
            ForEach(results) { document in
                NavigationLink(value: document.id) {
                    DocumentRowView(
                        document: document,
                        collectionName: collections.first(where: { $0.id == document.collectionId })?.name
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Library content (flat design)

    @ViewBuilder
    private var libraryContent: some View {
        if documents.isEmpty {
            BasemarkEmptyState(
                title: "No synced notes yet",
                message: "Pull to sync from your Basemark server, then start writing on mobile or browse your existing notes offline.",
                systemImage: "doc.text"
            )
        } else {
            LazyVStack(alignment: .leading, spacing: 0) {
                // Recent
                sectionHeader(title: "Recent", detail: "\(min(documents.count, 8)) notes")
                ForEach(Array(documents.prefix(8))) { document in
                    NavigationLink(value: document.id) {
                        DocumentRowView(
                            document: document,
                            collectionName: collections.first(where: { $0.id == document.collectionId })?.name
                        )
                    }
                    .buttonStyle(.plain)
                }

                // By collection
                let groupedCollections = collections.compactMap { collection -> (Collection, [Document])? in
                    let scoped = documents
                        .filter { $0.collectionId == collection.id }
                        .sorted { lhs, rhs in
                            if lhs.sortOrder == rhs.sortOrder {
                                return lhs.updatedAt > rhs.updatedAt
                            }
                            return lhs.sortOrder < rhs.sortOrder
                        }
                    return scoped.isEmpty ? nil : (collection, scoped)
                }

                ForEach(groupedCollections, id: \.0.id) { collection, scopedDocuments in
                    sectionHeader(
                        title: collection.name,
                        detail: "\(scopedDocuments.count) notes",
                        color: Color(basemarkHex: collection.color)
                    )
                    ForEach(scopedDocuments) { document in
                        NavigationLink(value: document.id) {
                            DocumentRowView(document: document, collectionName: collection.name)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Unfiled
                let unfiledDocuments = documents.filter { $0.collectionId == nil }
                if !unfiledDocuments.isEmpty {
                    sectionHeader(title: "Unfiled", detail: "\(unfiledDocuments.count) notes")
                    ForEach(unfiledDocuments) { document in
                        NavigationLink(value: document.id) {
                            DocumentRowView(document: document, collectionName: nil)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func load() {
        documents = (try? appState.database.fetchDocuments()) ?? []
        collections = (try? appState.database.fetchCollections()) ?? []
    }

    // MARK: - Flat section header

    private func sectionHeader(title: String, detail: String, color: Color? = nil) -> some View {
        HStack(alignment: .firstTextBaseline) {
            if let color {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
            }

            Text(title)
                .font(.system(.subheadline, design: .default, weight: .semibold))
                .foregroundStyle(BasemarkTheme.muted)

            Spacer(minLength: 8)

            Text(detail)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(BasemarkTheme.ghost)
        }
        .padding(.horizontal, 16)
        .padding(.top, 20)
        .padding(.bottom, 8)
    }
}
