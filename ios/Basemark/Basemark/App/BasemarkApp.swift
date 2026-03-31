import SwiftUI

@main
struct BasemarkApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environmentObject(appState)
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
            createAndOpenNote()
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

    private func createAndOpenNote(collectionID: String? = nil) {
        do {
            let localDocumentID = try appState.createLocalDocumentAndSync(collectionID: collectionID)
            appState.pendingNewNoteID = localDocumentID
        } catch {
            createErrorMessage = AppState.describe(error: error)
        }
    }
}
