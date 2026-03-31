import SwiftUI

struct SyncStatusView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        switch appState.syncState {
        case .idle:
            if let lastSyncAt = appState.lastSyncAt {
                Label(
                    lastSyncAt.formatted(date: .omitted, time: .shortened),
                    systemImage: "arrow.trianglehead.clockwise"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
            } else {
                Label("Offline", systemImage: "internaldrive")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .syncing:
            HStack(spacing: 8) {
                ProgressView()
                Text("Syncing")
            }
            .font(.caption)
        case let .failed(message):
            Label(message, systemImage: "exclamationmark.triangle.fill")
                .font(.caption)
                .foregroundStyle(.orange)
                .lineLimit(1)
        }
    }
}
