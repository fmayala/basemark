import Foundation

enum TiptapDocumentCodec {
    static func decodeNode(from content: String) -> TiptapNode? {
        guard let data = content.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(TiptapNode.self, from: data)
    }

    static func editableText(from content: String) -> String {
        guard let node = decodeNode(from: content) else {
            return content
        }

        return markdownText(from: node)
    }

    static func readableText(from content: String) -> String {
        guard let node = decodeNode(from: content) else {
            return content
        }

        return normalizedReadableText(from: node)
    }

    static func documentJSONString(fromPlainText plainText: String) -> String {
        let lines = plainText
            .replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n")

        let document = TiptapNode(type: "doc", text: nil, attrs: nil, marks: nil, content: parseBlocks(from: lines))
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]

        guard
            let data = try? encoder.encode(document),
            let string = String(data: data, encoding: .utf8)
        else {
            return plainText
        }

        return string
    }

    private static func normalizedReadableText(from node: TiptapNode) -> String {
        let blocks = collectReadableBlocks(from: node)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        return blocks.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func markdownText(from node: TiptapNode) -> String {
        collectMarkdownBlocks(from: node)
            .joined(separator: "\n")
            .replacingOccurrences(of: "\n\n\n", with: "\n\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func collectReadableBlocks(from node: TiptapNode) -> [String] {
        switch node.type {
        case "doc":
            return (node.content ?? []).flatMap(collectReadableBlocks(from:))
        case "paragraph", "heading", "blockquote", "codeBlock", "callout":
            return [inlineText(from: node).trimmingCharacters(in: .whitespacesAndNewlines)]
        case "bulletList", "orderedList", "taskList":
            return (node.content ?? []).flatMap(collectReadableBlocks(from:))
        case "listItem", "taskItem", "tableCell", "tableHeader":
            let text = (node.content ?? [])
                .flatMap(collectReadableBlocks(from:))
                .joined(separator: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return [text]
        case "table", "tableRow":
            return (node.content ?? []).flatMap(collectReadableBlocks(from:))
        case "image":
            return node.attrs?["src"]?.stringValue.map { [$0] } ?? []
        case "text":
            return [node.text ?? ""]
        default:
            if let content = node.content, !content.isEmpty {
                return content.flatMap(collectReadableBlocks(from:))
            }
            if let text = node.text {
                return [text]
            }
            return []
        }
    }

    private static func collectMarkdownBlocks(from node: TiptapNode) -> [String] {
        switch node.type {
        case "doc":
            return flattenMarkdownBlocks(from: node.content ?? [])
        case "paragraph":
            let text = inlineText(from: node).trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? [] : [text]
        case "heading":
            let level = max(1, min(Int(node.attrs?["level"]?.stringValue ?? "") ?? 1, 6))
            let text = inlineText(from: node).trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? [] : ["\(String(repeating: "#", count: level)) \(text)"]
        case "blockquote", "callout":
            let quoteLines = flattenMarkdownBlocks(from: node.content ?? [])
                .flatMap { $0.components(separatedBy: "\n") }
                .filter { !$0.isEmpty }
            return quoteLines.map { "> \($0)" }
        case "bulletList":
            return serializeList(node.content ?? [], prefix: { _ in "- " })
        case "orderedList":
            return serializeList(node.content ?? [], prefix: { index in "\(index + 1). " })
        case "taskList":
            return (node.content ?? []).map { item in
                let checked = item.attrs?["checked"]?.stringValue == "true"
                return "- [\(checked ? "x" : " ")] \(listItemText(from: item))"
            }
        case "codeBlock":
            return ["```", inlineText(from: node), "```"]
        case "horizontalRule":
            return ["---"]
        case "image":
            if let source = node.attrs?["src"]?.stringValue {
                return ["![image](\(source))"]
            }
            return []
        case "table":
            return (node.content ?? []).map { row in
                (row.content ?? [])
                    .map { inlineText(from: $0) }
                    .joined(separator: " | ")
            }
        default:
            if let content = node.content, !content.isEmpty {
                return flattenMarkdownBlocks(from: content)
            }

            let text = inlineText(from: node).trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? [] : [text]
        }
    }

    private static func flattenMarkdownBlocks(from nodes: [TiptapNode]) -> [String] {
        var blocks: [String] = []

        for child in nodes {
            let childBlocks = collectMarkdownBlocks(from: child)
            guard !childBlocks.isEmpty else { continue }
            blocks.append(contentsOf: childBlocks)
            blocks.append("")
        }

        while blocks.last?.isEmpty == true {
            blocks.removeLast()
        }

        return blocks
    }

    private static func inlineText(from node: TiptapNode) -> String {
        if let text = node.text {
            return text
        }

        return (node.content ?? [])
            .map(inlineText(from:))
            .joined(separator: " ")
    }

    private static func parseBlocks(from lines: [String]) -> [TiptapNode] {
        var blocks: [TiptapNode] = []
        var index = 0

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                index += 1
                continue
            }

            if trimmed.hasPrefix("```") {
                index += 1
                var codeLines: [String] = []
                while index < lines.count, !lines[index].trimmingCharacters(in: .whitespaces).hasPrefix("```") {
                    codeLines.append(lines[index])
                    index += 1
                }
                if index < lines.count { index += 1 }
                blocks.append(codeBlockNode(text: codeLines.joined(separator: "\n")))
                continue
            }

            if trimmed == "---" || trimmed == "***" {
                blocks.append(TiptapNode(type: "horizontalRule", text: nil, attrs: nil, marks: nil, content: nil))
                index += 1
                continue
            }

            if let heading = headingNode(from: trimmed) {
                blocks.append(heading)
                index += 1
                continue
            }

            if trimmed.hasPrefix("> ") {
                var quoteLines: [String] = []
                while index < lines.count {
                    let candidate = lines[index].trimmingCharacters(in: .whitespaces)
                    guard candidate.hasPrefix("> ") else { break }
                    quoteLines.append(String(candidate.dropFirst(2)))
                    index += 1
                }
                blocks.append(
                    TiptapNode(
                        type: "blockquote",
                        text: nil,
                        attrs: nil,
                        marks: nil,
                        content: [paragraphNode(text: quoteLines.joined(separator: " "))]
                    )
                )
                continue
            }

            if let listResult = parseList(from: lines, startIndex: index) {
                blocks.append(listResult.node)
                index = listResult.nextIndex
                continue
            }

            var paragraphLines: [String] = [trimmed]
            index += 1

            while index < lines.count {
                let candidate = lines[index]
                let candidateTrimmed = candidate.trimmingCharacters(in: .whitespaces)
                if candidateTrimmed.isEmpty || startsNewBlock(candidateTrimmed) {
                    break
                }
                paragraphLines.append(candidateTrimmed)
                index += 1
            }

            blocks.append(paragraphNode(text: paragraphLines.joined(separator: " ")))
        }

        return blocks.isEmpty ? [paragraphNode(text: "")] : blocks
    }

    private static func headingNode(from line: String) -> TiptapNode? {
        let hashes = line.prefix { $0 == "#" }
        guard (1 ... 6).contains(hashes.count) else { return nil }

        let remainder = line.dropFirst(hashes.count)
        guard remainder.first == " " else { return nil }
        let text = String(remainder.dropFirst().trimmingCharacters(in: .whitespacesAndNewlines))
        return TiptapNode(
            type: "heading",
            text: nil,
            attrs: ["level": .number(Double(hashes.count))],
            marks: nil,
            content: text.isEmpty ? [] : [textNode(text)]
        )
    }

    private static func parseList(from lines: [String], startIndex: Int) -> (node: TiptapNode, nextIndex: Int)? {
        guard startIndex < lines.count else { return nil }
        let first = lines[startIndex].trimmingCharacters(in: .whitespaces)

        if let task = parseTaskPrefix(from: first) {
            var items: [TiptapNode] = []
            var index = startIndex

            while index < lines.count, let parsed = parseTaskPrefix(from: lines[index].trimmingCharacters(in: .whitespaces)) {
                items.append(
                    TiptapNode(
                        type: "taskItem",
                        text: nil,
                        attrs: ["checked": .bool(parsed.checked)],
                        marks: nil,
                        content: [paragraphNode(text: parsed.text)]
                    )
                )
                index += 1
            }

            return (TiptapNode(type: "taskList", text: nil, attrs: nil, marks: nil, content: items), index)
        }

        if let bullet = parseBulletPrefix(from: first) {
            var items: [TiptapNode] = [listItemNode(text: bullet)]
            var index = startIndex + 1

            while index < lines.count, let parsed = parseBulletPrefix(from: lines[index].trimmingCharacters(in: .whitespaces)) {
                items.append(listItemNode(text: parsed))
                index += 1
            }

            return (TiptapNode(type: "bulletList", text: nil, attrs: nil, marks: nil, content: items), index)
        }

        if let ordered = parseOrderedPrefix(from: first) {
            var items: [TiptapNode] = [listItemNode(text: ordered)]
            var index = startIndex + 1

            while index < lines.count, let parsed = parseOrderedPrefix(from: lines[index].trimmingCharacters(in: .whitespaces)) {
                items.append(listItemNode(text: parsed))
                index += 1
            }

            return (TiptapNode(type: "orderedList", text: nil, attrs: nil, marks: nil, content: items), index)
        }

        return nil
    }

    private static func startsNewBlock(_ line: String) -> Bool {
        line.hasPrefix("```")
            || line.hasPrefix("> ")
            || line == "---"
            || line == "***"
            || headingNode(from: line) != nil
            || parseTaskPrefix(from: line) != nil
            || parseBulletPrefix(from: line) != nil
            || parseOrderedPrefix(from: line) != nil
    }

    private static func parseTaskPrefix(from line: String) -> (checked: Bool, text: String)? {
        guard line.hasPrefix("- ["), line.count > 5 else { return nil }

        let checkedCharacter = line[line.index(line.startIndex, offsetBy: 3)]
        let closingBracket = line[line.index(line.startIndex, offsetBy: 4)]
        let space = line[line.index(line.startIndex, offsetBy: 5)]

        guard (checkedCharacter == " " || checkedCharacter == "x" || checkedCharacter == "X"), closingBracket == "]", space == " " else {
            return nil
        }

        let text = String(line.dropFirst(6)).trimmingCharacters(in: .whitespacesAndNewlines)
        return (checkedCharacter == "x" || checkedCharacter == "X", text)
    }

    private static func parseBulletPrefix(from line: String) -> String? {
        guard line.hasPrefix("- ") || line.hasPrefix("* ") else { return nil }
        return String(line.dropFirst(2)).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func parseOrderedPrefix(from line: String) -> String? {
        guard let dotIndex = line.firstIndex(of: ".") else { return nil }
        let prefix = line[..<dotIndex]
        guard !prefix.isEmpty, prefix.allSatisfy({ $0.isNumber }) else { return nil }
        let remainder = line[line.index(after: dotIndex)...]
        guard remainder.first == " " else { return nil }
        return String(remainder.dropFirst().trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private static func codeBlockNode(text: String) -> TiptapNode {
        TiptapNode(
            type: "codeBlock",
            text: nil,
            attrs: nil,
            marks: nil,
            content: [textNode(text)]
        )
    }

    private static func paragraphNode(text: String) -> TiptapNode {
        TiptapNode(
            type: "paragraph",
            text: nil,
            attrs: nil,
            marks: nil,
            content: text.isEmpty ? [] : [textNode(text)]
        )
    }

    private static func listItemNode(text: String) -> TiptapNode {
        TiptapNode(
            type: "listItem",
            text: nil,
            attrs: nil,
            marks: nil,
            content: [paragraphNode(text: text)]
        )
    }

    private static func textNode(_ text: String) -> TiptapNode {
        TiptapNode(type: "text", text: text, attrs: nil, marks: nil, content: nil)
    }

    private static func serializeList(_ items: [TiptapNode], prefix: (Int) -> String) -> [String] {
        items.enumerated().map { index, item in
            prefix(index) + listItemText(from: item)
        }
    }

    private static func listItemText(from item: TiptapNode) -> String {
        flattenMarkdownBlocks(from: item.content ?? [])
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
