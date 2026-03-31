import SwiftUI

@main
struct BasemarkApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
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

    var body: some View {
        TabView {
            DocumentListView()
                .tabItem {
                    Label("Documents", systemImage: "doc.text")
                }

            CollectionListView()
                .tabItem {
                    Label("Collections", systemImage: "square.stack.3d.up")
                }

            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }
        }
        .overlay(alignment: .bottomTrailing) {
            if appState.syncState == .syncing {
                ProgressView()
                    .progressViewStyle(.circular)
                    .padding(12)
                    .background(.regularMaterial, in: Circle())
                    .padding()
            }
        }
    }
}
