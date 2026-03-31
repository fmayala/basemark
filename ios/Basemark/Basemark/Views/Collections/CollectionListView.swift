import SwiftUI

struct CollectionListView: View {
    @Environment(AppState.self) private var appState
    @State private var collections: [Collection] = []
    @State private var documents: [Document] = []

    var body: some View {
        NavigationStack {
            ZStack {
                BasemarkBackground()

                GeometryReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Collections")
                                .font(.system(size: 28, weight: .regular, design: .serif))
                                .italic()
                                .foregroundStyle(BasemarkTheme.ink)
                                .padding(.horizontal, 20)
                                .padding(.top, 12)

                            if collections.isEmpty {
                                BasemarkEmptyState(
                                    title: "No collections yet",
                                    message: "Collections appear after your first sync from Basemark.",
                                    systemImage: "square.stack.3d.up.slash"
                                )
                            } else {
                                ForEach(collections) { collection in
                                    NavigationLink {
                                        CollectionDetailView(collection: collection)
                                    } label: {
                                        collectionCard(for: collection)
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
            .navigationTitle("Collections")
            .navigationBarTitleDisplayMode(.inline)
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

    private func collectionCard(for collection: Collection) -> some View {
        let count = documents.filter { $0.collectionId == collection.id }.count

        return HStack(alignment: .top, spacing: 12) {
            Image(systemName: "folder")
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(Color(basemarkHex: collection.color) ?? BasemarkTheme.ghost)
                .frame(width: 22, height: 22)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 6) {
                Text(collection.name)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(BasemarkTheme.ink)
                    .lineLimit(2)

                Text("\(count) note\(count == 1 ? "" : "s")")
                    .font(.system(size: 13))
                    .foregroundStyle(BasemarkTheme.ghost)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(BasemarkTheme.muted)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(BasemarkTheme.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(BasemarkTheme.lineSubtle)
                .frame(height: 1)
                .padding(.leading, 50)
        }
        .contentShape(Rectangle())
    }
}
