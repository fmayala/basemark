import SwiftUI

struct DocumentEditorView: View {
    private enum EditorMode: String, CaseIterable, Identifiable {
        case write = "Write"
        case preview = "Preview"

        var id: String { rawValue }
    }

    private enum QuickInsertAction {
        case prefixLine(String)
        case wrapSelection(prefix: String, suffix: String, placeholder: String)
        case insertBlock(String)
    }

    private struct QuickInsert: Identifiable {
        let id: String
        let title: String
        let systemImage: String
        let action: QuickInsertAction
    }

    private static let quickInserts: [QuickInsert] = [
        QuickInsert(id: "heading", title: "Heading", systemImage: "textformat.size.larger", action: .prefixLine("# ")),
        QuickInsert(id: "section", title: "Section", systemImage: "textformat.size", action: .prefixLine("## ")),
        QuickInsert(id: "ordered", title: "Numbered", systemImage: "list.number", action: .prefixLine("1. ")),
        QuickInsert(id: "bullet", title: "Bullet", systemImage: "list.bullet", action: .prefixLine("- ")),
        QuickInsert(id: "task", title: "Checklist", systemImage: "checklist", action: .prefixLine("- [ ] ")),
        QuickInsert(id: "quote", title: "Quote", systemImage: "text.quote", action: .prefixLine("> ")),
        QuickInsert(id: "code", title: "Code", systemImage: "chevron.left.forwardslash.chevron.right", action: .wrapSelection(prefix: "```\n", suffix: "\n```", placeholder: "code")),
        QuickInsert(id: "divider", title: "Divider", systemImage: "minus", action: .insertBlock("---")),
    ]

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let documentID: String?
    let initialCollectionID: String?
    let onSaved: (Document) -> Void
    let onDeleted: (String) -> Void

    @State private var draft: DocumentDraft
    @State private var collections: [Collection] = []
    @State private var baseUpdatedAt: Int?
    @State private var isSaving = false
    @State private var showDeleteConfirmation = false
    @State private var errorMessage: String?
    @State private var conflictDocument: Document?
    @State private var originalDraft: DocumentDraft
    @State private var editorMode: EditorMode = .write
    @State private var selectedRange = NSRange(location: 0, length: 0)
    @State private var isBodyFocused = false

    init(
        documentID: String? = nil,
        initialCollectionID: String? = nil,
        onSaved: @escaping (Document) -> Void = { _ in },
        onDeleted: @escaping (String) -> Void = { _ in }
    ) {
        self.documentID = documentID
        self.initialCollectionID = initialCollectionID
        self.onSaved = onSaved
        self.onDeleted = onDeleted

        let seedDraft = DocumentDraft(collectionId: initialCollectionID)
        _draft = State(initialValue: seedDraft)
        _originalDraft = State(initialValue: seedDraft)
    }

    var body: some View {
        ZStack {
            BasemarkBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    titleCard
                    modeCard
                    bodyCard
                    organizeCard

                    if let errorMessage {
                        statusCard(title: "Needs attention", message: errorMessage, tone: .warning)
                    }

                    if let conflictDocument {
                        conflictCard(document: conflictDocument)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .navigationTitle(documentID == nil ? "New Note" : "Edit Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") {
                    dismiss()
                }
                .font(.system(.body, design: .rounded).weight(.semibold))
            }

            if documentID != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Image(systemName: "trash")
                    }
                }
            }

            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        await save()
                    }
                } label: {
                    if isSaving {
                        ProgressView()
                            .tint(BasemarkTheme.accent)
                    } else {
                        Text(documentID == nil ? "Create" : "Save")
                            .font(.system(.body, design: .rounded).weight(.bold))
                    }
                }
                .disabled(isSaving || !canSave)
            }

            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    isBodyFocused = false
                }
            }
        }
        .task {
            load()
        }
        .confirmationDialog(
            "Delete this note?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete Note", role: .destructive) {
                Task {
                    await deleteCurrentDocument()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the note from Basemark and from the local cache.")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            BasemarkSectionHeader(
                eyebrow: documentID == nil ? "Compose" : "Editing",
                title: documentID == nil ? "Write a note" : "Edit note",
                detail: nil
            )

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    BasemarkPill("\(wordCount) words", systemImage: "text.word.spacing")
                    BasemarkPill("\(blockCount) blocks", systemImage: "square.text.square")
                    BasemarkPill(readTimeLabel, systemImage: "timer")
                    if let baseUpdatedAt {
                        BasemarkPill(Self.absoluteDate(for: baseUpdatedAt), systemImage: "clock")
                    }
                }
            }
        }
    }

    private var titleCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Title")
                .font(.system(.caption, design: .rounded).weight(.bold))
                .foregroundStyle(BasemarkTheme.accent)

            TextField("Untitled", text: $draft.title, axis: .vertical)
                .font(.system(.title2, design: .rounded).weight(.bold))
                .foregroundStyle(BasemarkTheme.ink)
                .textFieldStyle(.plain)
        }
        .padding(.horizontal, 4)
    }

    private var modeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Mode", selection: $editorMode) {
                ForEach(EditorMode.allCases) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Self.quickInserts) { insert in
                        Button {
                            apply(insert.action)
                        } label: {
                            Label(insert.title, systemImage: insert.systemImage)
                                .font(.system(.caption, design: .rounded).weight(.bold))
                                .foregroundStyle(BasemarkTheme.ink)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(BasemarkTheme.surface, in: Capsule())
                                .overlay {
                                    Capsule()
                                        .stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Text("Formatting acts on the active line or the current selection. Supported syntax still includes `#`, `##`, `1.`, `-`, `- [ ]`, `>`, fenced code blocks, and `---`.")
                .font(.system(.footnote, design: .rounded))
                .foregroundStyle(BasemarkTheme.muted)
        }
        .padding(.horizontal, 4)
    }

    private var bodyCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(editorMode == .write ? "Body" : "Preview")
                .font(.system(.caption, design: .rounded).weight(.bold))
                .foregroundStyle(BasemarkTheme.accent)

            if editorMode == .write {
                ZStack(alignment: .topLeading) {
                    if draft.bodyText.isEmpty {
                        Text("Start typing with plain text or use the chips above to format the active line.")
                            .font(.system(.body, design: .rounded))
                            .foregroundStyle(BasemarkTheme.muted.opacity(0.8))
                            .padding(.top, 8)
                    }

                    MarkdownTextView(
                        text: $draft.bodyText,
                        selectedRange: $selectedRange,
                        isFocused: $isBodyFocused,
                        growsWithContent: true
                    )
                }
            } else if draft.normalizedBodyText.isEmpty {
                BasemarkEmptyState(
                    title: "Nothing to preview yet",
                    message: "Switch back to Write mode and add some content.",
                    systemImage: "eye.slash"
                )
            } else {
                TiptapRenderer(content: draft.encodedContent)
                    .foregroundStyle(BasemarkTheme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: 320, alignment: .topLeading)
            }
        }
        .padding(.horizontal, 4)
        .animation(.snappy, value: editorMode)
    }

    private var organizeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Organization")
                .font(.system(.caption, design: .rounded).weight(.bold))
                .foregroundStyle(BasemarkTheme.accent)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    collectionChip(title: "Unfiled", selected: draft.collectionId == nil) {
                        draft.collectionId = nil
                    }

                    ForEach(collections) { collection in
                        collectionChip(
                            title: collection.name,
                            color: Color(basemarkHex: collection.color),
                            selected: draft.collectionId == collection.id
                        ) {
                            draft.collectionId = collection.id
                        }
                    }
                }
            }

            Toggle(isOn: $draft.isPublic) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Public")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .foregroundStyle(BasemarkTheme.ink)
                    Text("Matches the server-side share visibility flag.")
                        .font(.system(.footnote, design: .rounded))
                        .foregroundStyle(BasemarkTheme.muted)
                }
            }
            .toggleStyle(.switch)
            .tint(BasemarkTheme.accent)
        }
        .padding(.horizontal, 4)
    }

    private func conflictCard(document: Document) -> some View {
        BasemarkCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Server version changed")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(BasemarkTheme.warning)

                Text("Your last save hit a conflict. Review the latest copy or tap Save again to overwrite it using the new server timestamp.")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(BasemarkTheme.muted)

                HStack(spacing: 10) {
                    Button("Load Server Copy") {
                        let serverDraft = DocumentDraft(document: document)
                        draft = serverDraft
                        originalDraft = serverDraft
                        baseUpdatedAt = document.updatedAt
                        selectedRange = NSRange(location: (serverDraft.bodyText as NSString).length, length: 0)
                        conflictDocument = nil
                        errorMessage = nil
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(BasemarkTheme.warning)

                    Button("Keep Editing") {
                        conflictDocument = nil
                        isBodyFocused = true
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private func statusCard(title: String, message: String, tone: BasemarkPill.Tone) -> some View {
        BasemarkCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(tone == .warning ? BasemarkTheme.warning : BasemarkTheme.ink)

                Text(message)
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(BasemarkTheme.muted)
            }
        }
    }

    private var canSave: Bool {
        if documentID == nil {
            return !draft.isMeaningfullyEmpty
        }

        return baseUpdatedAt != nil && draft != originalDraft
    }

    private var wordCount: Int {
        draft.normalizedBodyText
            .split(whereSeparator: \.isWhitespace)
            .count
    }

    private var blockCount: Int {
        draft.bodyText
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .count
    }

    private var readTimeLabel: String {
        guard wordCount > 0 else { return "0 min read" }
        return "\(max(1, Int(ceil(Double(wordCount) / 180)))) min read"
    }

    private func collectionChip(
        title: String,
        color: Color? = nil,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Circle()
                    .fill(color ?? BasemarkTheme.surfaceStrong)
                    .frame(width: 10, height: 10)
                Text(title)
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
            }
            .foregroundStyle(selected ? .white : BasemarkTheme.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                selected ? BasemarkTheme.accent : BasemarkTheme.surface,
                in: Capsule()
            )
            .overlay {
                Capsule()
                    .stroke(selected ? BasemarkTheme.accent : BasemarkTheme.lineSubtle, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }

    private func load() {
        collections = (try? appState.database.fetchCollections()) ?? []

        guard let documentID else {
            if draft.collectionId == nil {
                draft.collectionId = initialCollectionID
                originalDraft.collectionId = initialCollectionID
            }
            return
        }

        guard let document = try? appState.database.fetchDocument(id: documentID) else {
            return
        }

        let loadedDraft = DocumentDraft(document: document)
        draft = loadedDraft
        originalDraft = loadedDraft
        baseUpdatedAt = document.updatedAt
        selectedRange = NSRange(location: (loadedDraft.bodyText as NSString).length, length: 0)
    }

    private func apply(_ action: QuickInsertAction) {
        switch action {
        case let .prefixLine(prefix):
            let result = Self.prefixedCurrentLines(in: draft.bodyText, selectedRange: selectedRange, prefix: prefix)
            draft.bodyText = result.text
            selectedRange = result.range
        case let .wrapSelection(prefix, suffix, placeholder):
            let result = Self.wrappedSelection(
                in: draft.bodyText,
                selectedRange: selectedRange,
                prefix: prefix,
                suffix: suffix,
                placeholder: placeholder
            )
            draft.bodyText = result.text
            selectedRange = result.range
        case let .insertBlock(snippet):
            let result = Self.insertedBlock(in: draft.bodyText, selectedRange: selectedRange, snippet: snippet)
            draft.bodyText = result.text
            selectedRange = result.range
        }

        editorMode = .write
        isBodyFocused = true
    }

    private func save() async {
        guard !isSaving else { return }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            if let documentID {
                guard let baseUpdatedAt else {
                    errorMessage = "The latest server version could not be loaded for this note."
                    return
                }

                let result = try await appState.saveDocument(
                    documentID: documentID,
                    draft: draft,
                    baseUpdatedAt: baseUpdatedAt
                )

                switch result {
                case let .saved(document):
                    let savedDraft = DocumentDraft(document: document)
                    draft = savedDraft
                    originalDraft = savedDraft
                    self.baseUpdatedAt = document.updatedAt
                    selectedRange = NSRange(location: (savedDraft.bodyText as NSString).length, length: 0)
                    conflictDocument = nil
                    onSaved(document)
                    dismiss()
                case let .conflict(document):
                    self.baseUpdatedAt = document.updatedAt
                    conflictDocument = document
                    errorMessage = APIError.conflict(document).errorDescription
                }
            } else {
                let document = try await appState.createDocument(draft: draft)
                let savedDraft = DocumentDraft(document: document)
                draft = savedDraft
                originalDraft = savedDraft
                baseUpdatedAt = document.updatedAt
                selectedRange = NSRange(location: (savedDraft.bodyText as NSString).length, length: 0)
                conflictDocument = nil
                onSaved(document)
                dismiss()
            }
        } catch {
            errorMessage = AppState.describe(error: error)
        }
    }

    private func deleteCurrentDocument() async {
        guard let documentID else { return }

        do {
            try await appState.deleteDocument(id: documentID)
            onDeleted(documentID)
            dismiss()
        } catch {
            errorMessage = AppState.describe(error: error)
        }
    }

    private static func prefixedCurrentLines(in text: String, selectedRange: NSRange, prefix: String) -> (text: String, range: NSRange) {
        let source = text as NSString
        let safeRange = safeRange(selectedRange, in: text)
        let targetLineRange = source.lineRange(for: safeRange)
        let lineBlock = source.substring(with: targetLineRange)
        let hasTrailingNewline = lineBlock.hasSuffix("\n")
        var lines = lineBlock.components(separatedBy: "\n")

        if hasTrailingNewline, lines.last == "" {
            lines.removeLast()
        }

        let updatedLines = lines.map { line -> String in
            if line.isEmpty { return prefix.trimmingCharacters(in: .whitespaces) }
            return prefix + line
        }

        var replacement = updatedLines.joined(separator: "\n")
        if hasTrailingNewline {
            replacement += "\n"
        }

        let updatedText = source.replacingCharacters(in: targetLineRange, with: replacement)
        return (updatedText, NSRange(location: targetLineRange.location, length: (replacement as NSString).length))
    }

    private static func wrappedSelection(
        in text: String,
        selectedRange: NSRange,
        prefix: String,
        suffix: String,
        placeholder: String
    ) -> (text: String, range: NSRange) {
        let source = text as NSString
        let safeRange = safeRange(selectedRange, in: text)
        let selectedText = safeRange.length > 0 ? source.substring(with: safeRange) : placeholder
        let replacement = prefix + selectedText + suffix
        let updatedText = source.replacingCharacters(in: safeRange, with: replacement)
        let selectionLocation = safeRange.location + (prefix as NSString).length
        let selectionLength = (selectedText as NSString).length
        return (updatedText, NSRange(location: selectionLocation, length: selectionLength))
    }

    private static func insertedBlock(in text: String, selectedRange: NSRange, snippet: String) -> (text: String, range: NSRange) {
        let source = text as NSString
        let safeRange = safeRange(selectedRange, in: text)
        let prefix = source.length == 0 ? "" : "\n\n"
        let replacement = prefix + snippet
        let updatedText = source.replacingCharacters(in: safeRange, with: replacement)
        let cursorLocation = safeRange.location + (replacement as NSString).length
        return (updatedText, NSRange(location: cursorLocation, length: 0))
    }

    private static func safeRange(_ range: NSRange, in text: String) -> NSRange {
        let length = (text as NSString).length
        let location = min(max(0, range.location), length)
        let maxLength = max(0, length - location)
        return NSRange(location: location, length: min(max(0, range.length), maxLength))
    }

    private static func absoluteDate(for timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
