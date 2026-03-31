import SwiftUI

@main
struct BasemarkApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .tint(BasemarkTheme.accent)
                .preferredColorScheme(.dark)
                .task {
                    await appState.refreshIfPossible()
                }
                .onChange(of: scenePhase) { _, newPhase in
                    guard newPhase == .active else { return }
                    Task {
                        await appState.refreshIfPossible()
                    }
                }
        }
    }
}

private struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.snappy, value: appState.isAuthenticated)
    }
}

private struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = 0
    @State private var isCreatingNote = false
    @State private var createErrorMessage: String?

    var body: some View {
        TabView(selection: $selectedTab) {
            DocumentListView()
                .tabItem {
                    Label("Notes", systemImage: "doc.text")
                }
                .tag(0)

            Color.clear
                .tabItem {
                    Label("New", systemImage: "square.and.pencil")
                }
                .tag(1)

            CollectionListView()
                .tabItem {
                    Label("Collections", systemImage: "square.stack.3d.up")
                }
                .tag(2)
        }
        .toolbarBackground(BasemarkTheme.surface.opacity(0.95), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .onChange(of: selectedTab) { _, newValue in
            guard newValue == 1 else { return }
            selectedTab = 0
            Task {
                await createAndOpenNote()
            }
        }
        .overlay {
            if isCreatingNote {
                ProgressView("Creating note…")
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(BasemarkTheme.surfaceElevated, in: Capsule())
                    .overlay {
                        Capsule().stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
                    }
            }
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

    private func createAndOpenNote(collectionID: String? = nil) async {
        guard !isCreatingNote else { return }

        isCreatingNote = true
        defer { isCreatingNote = false }

        do {
            let document = try await appState.createDocument(
                draft: DocumentDraft(collectionId: collectionID)
            )
            appState.pendingNewNoteID = document.id
        } catch {
            createErrorMessage = AppState.describe(error: error)
        }
    }
}
