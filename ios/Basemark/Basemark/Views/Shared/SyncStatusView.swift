import SwiftUI

struct SyncStatusView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        switch appState.syncState {
        case .idle:
            if let lastSyncAt = appState.lastSyncAt {
                BasemarkPill(
                    lastSyncAt.formatted(date: .omitted, time: .shortened),
                    systemImage: "arrow.trianglehead.clockwise",
                    tone: .neutral
                )
            } else {
                BasemarkPill("Cached", systemImage: "internaldrive", tone: .neutral)
            }
        case .syncing:
            HStack(spacing: 8) {
                ProgressView()
                    .tint(BasemarkTheme.accent)
                Text("Syncing")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(BasemarkTheme.faint)
            }
        case let .failed(message):
            BasemarkPill("Sync failed", systemImage: "exclamationmark.triangle.fill", tone: .warning)
                .accessibilityHint(message)
        }
    }
}
