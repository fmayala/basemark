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
    var body: some View {
        DocumentListView()
    }
}
