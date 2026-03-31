import SwiftUI

struct DocumentRowView: View {
    let document: Document
    let collectionName: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "doc")
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(BasemarkTheme.ghost)
                .frame(width: 22, height: 22)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 6) {
                Text(document.displayTitle)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(BasemarkTheme.ink)
                    .lineLimit(2)

                if !document.bodyPreview.isEmpty {
                    Text(document.bodyPreview)
                        .font(.system(size: 14))
                        .foregroundStyle(BasemarkTheme.faint)
                        .lineLimit(2)
                }

                HStack(spacing: 4) {
                    if let collectionName, !collectionName.isEmpty {
                        Text(collectionName)
                            .lineLimit(1)
                        Text("·")
                            .opacity(0.4)
                    }

                    Text(Self.relativeDate(for: document.updatedAt))

                    if document.isPublic {
                        Text("·")
                            .opacity(0.4)
                        Text("Public")
                            .foregroundStyle(BasemarkTheme.accent)
                    }
                }
                .font(.system(size: 13))
                .foregroundStyle(BasemarkTheme.ghost)
            }
            Spacer(minLength: 0)
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

    private static func relativeDate(for timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        return date.formatted(.relative(presentation: .named))
    }
}
