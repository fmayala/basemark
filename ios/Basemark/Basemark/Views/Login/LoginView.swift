import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            ZStack {
                BasemarkBackground()

                GeometryReader { proxy in
                    ScrollView {
                        VStack(spacing: 28) {
                            Spacer(minLength: 0)

                            // Logo + wordmark (matches web layout)
                            HStack(spacing: 10) {
                                Text("Basemark")
                                    .font(.system(size: 38, weight: .regular, design: .serif))
                                    .italic()
                                    .foregroundStyle(BasemarkTheme.ink)

                                BasemarkLogo(size: 44)
                            }

                            VStack(spacing: 12) {
                                // Error message
                                if let error = appState.lastErrorMessage {
                                    Text(error)
                                        .font(.system(size: 14))
                                        .foregroundStyle(BasemarkTheme.danger)
                                        .multilineTextAlignment(.center)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                        .frame(maxWidth: .infinity)
                                        .background(BasemarkTheme.danger.opacity(0.10), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                                        .overlay {
                                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                .stroke(BasemarkTheme.danger.opacity(0.20), lineWidth: 1)
                                        }
                                }

                                // Google Sign-In button
                                Button {
                                    Task {
                                        await appState.signInWithGoogle()
                                    }
                                } label: {
                                    HStack(spacing: 12) {
                                        Spacer()
                                        if appState.isAuthenticating {
                                            ProgressView()
                                                .tint(BasemarkTheme.ink)
                                        } else {
                                            GoogleLogo()
                                                .frame(width: 18, height: 18)
                                            Text("Sign in with Google")
                                        }
                                        Spacer()
                                    }
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(BasemarkTheme.ink)
                                    .padding(.vertical, 14)
                                    .background(BasemarkTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
                                    }
                                }
                                .buttonStyle(.plain)
                                .disabled(appState.isAuthenticating)
                            }
                            .frame(maxWidth: 360)

                            Text("Only the workspace owner can sign in.")
                                .font(.system(size: 12))
                                .foregroundStyle(BasemarkTheme.ghost)

                            Spacer(minLength: 0)
                        }
                        .frame(maxWidth: .infinity, minHeight: proxy.size.height)
                        .padding(.horizontal, 24)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

// MARK: - Google Logo (official colors)

private struct GoogleLogo: View {
    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24

            // Blue quadrant (top-right)
            var blue = Path()
            blue.move(to: p(22.56, 12.25, scale))
            blue.addLine(to: p(22.56, 10.0, scale))
            blue.addLine(to: p(12, 10.0, scale))
            blue.addLine(to: p(12, 14.26, scale))
            blue.addLine(to: p(17.92, 14.26, scale))
            blue.addLine(to: p(15.72, 17.58, scale))
            blue.addLine(to: p(19.29, 20.35, scale))
            blue.addLine(to: p(22.56, 12.25, scale))
            blue.closeSubpath()
            context.fill(blue, with: .color(Color(red: 0.259, green: 0.522, blue: 0.957)))

            // Green quadrant (bottom-right)
            var green = Path()
            green.move(to: p(12, 23, scale))
            green.addLine(to: p(12, 23, scale))
            green.addLine(to: p(19.28, 20.34, scale))
            green.addLine(to: p(15.71, 17.57, scale))
            green.addLine(to: p(12, 18.63, scale))
            green.addLine(to: p(5.84, 14.09, scale))
            green.addLine(to: p(2.18, 16.93, scale))
            green.addLine(to: p(12, 23, scale))
            green.closeSubpath()
            context.fill(green, with: .color(Color(red: 0.204, green: 0.659, blue: 0.325)))

            // Yellow quadrant (bottom-left)
            var yellow = Path()
            yellow.move(to: p(5.84, 14.09, scale))
            yellow.addLine(to: p(5.49, 12, scale))
            yellow.addLine(to: p(5.84, 9.91, scale))
            yellow.addLine(to: p(2.18, 7.07, scale))
            yellow.addLine(to: p(1, 12, scale))
            yellow.addLine(to: p(2.18, 16.93, scale))
            yellow.addLine(to: p(5.84, 14.09, scale))
            yellow.closeSubpath()
            context.fill(yellow, with: .color(Color(red: 0.984, green: 0.737, blue: 0.020)))

            // Red quadrant (top-left)
            var red = Path()
            red.move(to: p(12, 5.38, scale))
            red.addLine(to: p(16.21, 7.02, scale))
            red.addLine(to: p(19.36, 3.87, scale))
            red.addLine(to: p(12, 1, scale))
            red.addLine(to: p(2.18, 7.07, scale))
            red.addLine(to: p(5.84, 9.91, scale))
            red.addLine(to: p(12, 5.38, scale))
            red.closeSubpath()
            context.fill(red, with: .color(Color(red: 0.918, green: 0.263, blue: 0.208)))
        }
    }

    private func p(_ x: CGFloat, _ y: CGFloat, _ scale: CGFloat) -> CGPoint {
        CGPoint(x: x * scale, y: y * scale)
    }
}
