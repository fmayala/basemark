import SwiftUI

struct TiptapRenderer: View {
    let content: String

    var body: some View {
        if let node = decodeNode() {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array((node.content ?? [node]).enumerated()), id: \.offset) { _, child in
                    TiptapNodeView(node: child)
                }
            }
        } else {
            Text(content)
                .font(.body)
                .textSelection(.enabled)
        }
    }

    private func decodeNode() -> TiptapNode? {
        guard let data = content.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(TiptapNode.self, from: data)
    }
}

private struct TiptapNodeView: View {
    let node: TiptapNode

    var body: some View {
        switch node.type {
        case "doc":
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { _, child in
                    TiptapNodeView(node: child)
                }
            }
        case "paragraph":
            inlineText(for: node.content ?? [node])
                .frame(maxWidth: .infinity, alignment: .leading)
        case "heading":
            inlineText(for: node.content ?? [node])
                .font(fontForHeading(level: node.attrs?["level"]?.stringValue))
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity, alignment: .leading)
        case "bulletList", "orderedList", "taskList":
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { index, child in
                    HStack(alignment: .top, spacing: 8) {
                        Text(marker(for: node.type, index: index, child: child))
                            .foregroundStyle(.secondary)
                        TiptapNodeView(node: child)
                    }
                }
            }
        case "listItem", "taskItem":
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { _, child in
                    TiptapNodeView(node: child)
                }
            }
        case "blockquote":
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { _, child in
                    TiptapNodeView(node: child)
                }
            }
            .padding(.leading, 12)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(Color.secondary.opacity(0.35))
                    .frame(width: 3)
            }
        case "codeBlock":
            ScrollView(.horizontal, showsIndicators: false) {
                Text(plainText(for: node))
                    .font(.system(.body, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
            }
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        case "horizontalRule":
            Divider()
        case "image":
            if let source = node.attrs?["src"]?.stringValue, let url = URL(string: source) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFit()
                } placeholder: {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        case "callout":
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { _, child in
                    TiptapNodeView(node: child)
                }
            }
            .padding(12)
            .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        case "table":
            VStack(spacing: 8) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .top, spacing: 8) {
                        ForEach(Array((row.content ?? []).enumerated()), id: \.offset) { _, cell in
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(Array((cell.content ?? []).enumerated()), id: \.offset) { _, child in
                                    TiptapNodeView(node: child)
                                }
                            }
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }
            }
        case "tableRow", "tableCell", "tableHeader":
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array((node.content ?? []).enumerated()), id: \.offset) { _, child in
                    TiptapNodeView(node: child)
                }
            }
        case "text":
            inlineText(for: [node])
        default:
            if let children = node.content, !children.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(children.enumerated()), id: \.offset) { _, child in
                        TiptapNodeView(node: child)
                    }
                }
            } else if let text = node.text, !text.isEmpty {
                Text(text)
            }
        }
    }

    private func inlineText(for nodes: [TiptapNode]) -> Text {
        nodes.reduce(Text(""), { partial, child in
            partial + styledText(for: child)
        })
    }

    private func styledText(for node: TiptapNode) -> Text {
        let base = Text(node.text ?? plainText(for: node))
        return (node.marks ?? []).reduce(base) { partial, mark in
            switch mark.type {
            case "bold":
                return partial.bold()
            case "italic":
                return partial.italic()
            case "code":
                return partial.font(.system(.body, design: .monospaced))
            case "strike":
                return partial.strikethrough()
            case "link":
                return partial.foregroundColor(.blue).underline()
            default:
                return partial
            }
        }
    }

    private func fontForHeading(level: String?) -> Font {
        switch Int(level ?? "") ?? 2 {
        case 1:
            return .system(.largeTitle, design: .rounded)
        case 2:
            return .system(.title, design: .rounded)
        case 3:
            return .system(.title2, design: .rounded)
        default:
            return .headline
        }
    }

    private func marker(for type: String, index: Int, child: TiptapNode) -> String {
        if type == "taskList" || child.type == "taskItem" {
            let checked = child.attrs?["checked"]?.stringValue == "true"
            return checked ? "checkmark.square.fill" : "square"
        }

        if type == "orderedList" {
            return "\(index + 1)."
        }

        return "•"
    }

    private func plainText(for node: TiptapNode) -> String {
        if let text = node.text {
            return text
        }

        return (node.content ?? [])
            .map(plainText(for:))
            .joined(separator: " ")
    }
}
