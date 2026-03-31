import SwiftUI

// MARK: - Logo

/// Replicates the web app's wave-mark SVG: M5 18 L10.2 7.5 Q11 6 11.8 7.5 L13.2 11 Q14 12.5 14.8 11 L19 6
struct BasemarkLogo: View {
    var size: CGFloat = 24

    var body: some View {
        ZStack {
            BasemarkWavePath()
                .stroke(
                    LinearGradient(
                        stops: [
                            .init(color: BasemarkTheme.ink.opacity(0.12), location: 0.00),
                            .init(color: BasemarkTheme.ink.opacity(0.60), location: 0.20),
                            .init(color: BasemarkTheme.ink.opacity(1.00), location: 0.40),
                            .init(color: BasemarkTheme.ink.opacity(0.90), location: 0.55),
                            .init(color: BasemarkTheme.ink.opacity(0.45), location: 0.70),
                            .init(color: BasemarkTheme.ink.opacity(0.15), location: 1.00),
                        ],
                        startPoint: UnitPoint(x: 0, y: 0.7),
                        endPoint: UnitPoint(x: 1, y: 0.3)
                    ),
                    style: StrokeStyle(lineWidth: size < 20 ? 2.5 : size < 32 ? 2 : 1.8, lineCap: .round, lineJoin: .round)
                )
        }
        .frame(width: size, height: size)
    }
}

private struct BasemarkWavePath: Shape {
    func path(in rect: CGRect) -> Path {
        // SVG viewBox 0 0 24 24, path: M5 18 L10.2 7.5 Q11 6 11.8 7.5 L13.2 11 Q14 12.5 14.8 11 L19 6
        let sx = rect.width / 24
        let sy = rect.height / 24

        var path = Path()
        path.move(to: CGPoint(x: 5 * sx, y: 18 * sy))
        path.addLine(to: CGPoint(x: 10.2 * sx, y: 7.5 * sy))
        path.addQuadCurve(
            to: CGPoint(x: 11.8 * sx, y: 7.5 * sy),
            control: CGPoint(x: 11 * sx, y: 6 * sy)
        )
        path.addLine(to: CGPoint(x: 13.2 * sx, y: 11 * sy))
        path.addQuadCurve(
            to: CGPoint(x: 14.8 * sx, y: 11 * sy),
            control: CGPoint(x: 14 * sx, y: 12.5 * sy)
        )
        path.addLine(to: CGPoint(x: 19 * sx, y: 6 * sy))
        return path
    }
}

// MARK: - Theme

enum BasemarkTheme {
    static let background = Color(red: 0.15, green: 0.15, blue: 0.15)
    static let backgroundSidebar = Color(red: 0.12, green: 0.12, blue: 0.12)
    static let surface = Color(red: 0.15, green: 0.15, blue: 0.15)
    static let surfaceElevated = Color(red: 0.16, green: 0.16, blue: 0.16)
    static let surfaceHover = Color(red: 0.21, green: 0.21, blue: 0.21)
    static let surfaceStrong = surfaceHover
    static let input = Color(red: 0.16, green: 0.16, blue: 0.16)
    static let line = Color(red: 0.16, green: 0.16, blue: 0.16)
    static let lineSubtle = Color(red: 0.21, green: 0.21, blue: 0.21)
    static let ink = Color(red: 0.85, green: 0.85, blue: 0.85)
    static let muted = Color(red: 0.70, green: 0.70, blue: 0.70)
    static let faint = Color(red: 0.60, green: 0.60, blue: 0.60)
    static let ghost = Color(red: 0.40, green: 0.40, blue: 0.40)
    static let accent = Color(red: 0.03, green: 0.53, blue: 0.84)
    static let accentSoft = Color(red: 0.03, green: 0.53, blue: 0.84).opacity(0.12)
    static let danger = Color(red: 0.93, green: 0.15, blue: 0.32)
    static let warning = Color(red: 0.94, green: 0.54, blue: 0.14)
    static let success = Color(red: 0.23, green: 0.85, blue: 0.52)
}

struct BasemarkBackground: View {
    var body: some View {
        BasemarkTheme.background
            .overlay(alignment: .topTrailing) {
                Circle()
                    .fill(BasemarkTheme.accent.opacity(0.08))
                    .frame(width: 300, height: 300)
                    .blur(radius: 40)
                    .offset(x: 110, y: -120)
            }
            .ignoresSafeArea()
    }
}

struct BasemarkCard<Content: View>: View {
    let padding: CGFloat
    @ViewBuilder var content: Content

    init(padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(BasemarkTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
            }
    }
}

struct BasemarkPill: View {
    enum Tone {
        case neutral
        case accent
        case success
        case warning
    }

    let title: String
    let systemImage: String
    let tone: Tone

    init(_ title: String, systemImage: String, tone: Tone = .neutral) {
        self.title = title
        self.systemImage = systemImage
        self.tone = tone
    }

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(backgroundColor, in: Capsule())
            .overlay {
                Capsule()
                    .stroke(borderColor, lineWidth: 1)
            }
    }

    private var foregroundColor: Color {
        switch tone {
        case .neutral:
            return BasemarkTheme.faint
        case .accent:
            return BasemarkTheme.accent
        case .success:
            return BasemarkTheme.success
        case .warning:
            return BasemarkTheme.warning
        }
    }

    private var backgroundColor: Color {
        switch tone {
        case .neutral:
            return BasemarkTheme.surfaceElevated
        case .accent:
            return BasemarkTheme.accentSoft
        case .success:
            return BasemarkTheme.success.opacity(0.10)
        case .warning:
            return BasemarkTheme.warning.opacity(0.10)
        }
    }

    private var borderColor: Color {
        switch tone {
        case .neutral:
            return BasemarkTheme.lineSubtle
        case .accent:
            return BasemarkTheme.accent.opacity(0.24)
        case .success:
            return BasemarkTheme.success.opacity(0.24)
        case .warning:
            return BasemarkTheme.warning.opacity(0.24)
        }
    }
}

struct BasemarkSectionHeader: View {
    let eyebrow: String?
    let title: String
    let detail: String?

    init(eyebrow: String? = nil, title: String, detail: String? = nil) {
        self.eyebrow = eyebrow
        self.title = title
        self.detail = detail
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let eyebrow {
                Text(eyebrow.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(BasemarkTheme.ghost)
                    .tracking(0.8)
            }

            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(.system(.title3, design: .serif).weight(.regular))
                    .italic()
                    .foregroundStyle(BasemarkTheme.ink)

                Spacer(minLength: 12)

                if let detail {
                    Text(detail)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(BasemarkTheme.ghost)
                }
            }
        }
    }
}

struct BasemarkEmptyState: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(BasemarkTheme.ghost)

            Text(title)
                .font(.system(.headline, design: .default).weight(.medium))
                .foregroundStyle(BasemarkTheme.ink)

            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(BasemarkTheme.faint)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 24)
    }
}

struct BasemarkSearchField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(BasemarkTheme.ghost)

            TextField(title, text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(BasemarkTheme.ink)

            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(BasemarkTheme.ghost)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(BasemarkTheme.input, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
        }
    }
}

struct BasemarkFloatingButton: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(BasemarkTheme.accent, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

extension Color {
    init?(basemarkHex: String?) {
        guard
            var hex = basemarkHex?.trimmingCharacters(in: .whitespacesAndNewlines),
            !hex.isEmpty
        else {
            return nil
        }

        if hex.hasPrefix("#") {
            hex.removeFirst()
        }

        guard hex.count == 6, let value = Int(hex, radix: 16) else {
            return nil
        }

        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        self.init(red: red, green: green, blue: blue)
    }
}
