import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var serverURL = ""
    @State private var token = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("https://basemark.example.com", text: $serverURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()

                    SecureField("bm_...", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section {
                    Button {
                        Task {
                            await appState.signIn(serverURLString: serverURL, token: token)
                        }
                    } label: {
                        if appState.isAuthenticating {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Connect")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || token.isEmpty || appState.isAuthenticating)
                }

                if let error = appState.lastErrorMessage {
                    Section("Error") {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                Section("Phase 1") {
                    Text("This app syncs documents down for offline browsing, reading, and local search.")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Basemark")
        }
    }
}
