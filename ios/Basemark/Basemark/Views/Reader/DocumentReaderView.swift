import SwiftUI

struct DocumentReaderView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let documentID: String

    @State private var draft: DocumentDraft = DocumentDraft()
    @State private var originalDraft: DocumentDraft = DocumentDraft()
    @State private var baseUpdatedAt: Int?
    @State private var collections: [Collection] = []
    @State private var selectedRange = NSRange(location: 0, length: 0)
    @State private var isBodyFocused = false
    @State private var isSaving = false
    @State private var showConfig = false
    @State private var showDeleteConfirmation = false
    @State private var errorMessage: String?
    @State private var conflictDocument: Document?
    @State private var deletedDocumentID: String?
    @State private var isMissingFromCache = false
    @State private var saveTask: Task<Void, Never>?
    @State private var isDeleting = false

    var body: some View {
        ZStack {
            BasemarkBackground()

            GeometryReader { proxy in
                if deletedDocumentID != nil {
                    BasemarkEmptyState(
                        title: "Document deleted",
                        message: "This note was removed from Basemark.",
                        systemImage: "doc.questionmark"
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if isMissingFromCache || baseUpdatedAt == nil {
                    BasemarkEmptyState(
                        title: "Document unavailable",
                        message: "This note is no longer in the local cache.",
                        systemImage: "doc.questionmark"
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if let conflictDocument {
                                conflictBanner(document: conflictDocument)
                            } else if let errorMessage {
                                errorBanner(message: errorMessage)
                            }

                            TextField("Untitled", text: $draft.title, axis: .vertical)
                                .font(.system(size: 30, weight: .regular, design: .serif))
                                .italic()
                                .foregroundStyle(BasemarkTheme.ink)
                                .textFieldStyle(.plain)
                                .padding(.horizontal, 20)
                                .padding(.top, 16)

                            ZStack(alignment: .topLeading) {
                                if draft.bodyText.isEmpty {
                                    Text("Start writing...")
                                        .font(.body)
                                        .foregroundStyle(BasemarkTheme.ghost)
                                        .padding(.horizontal, 20)
                                        .padding(.top, 2)
                                        .allowsHitTesting(false)
                                }

                                MarkdownTextView(
                                    text: $draft.bodyText,
                                    selectedRange: $selectedRange,
                                    isFocused: $isBodyFocused,
                                    growsWithContent: true
                                )
                                .padding(.horizontal, 20)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .topLeading)
                        .padding(.bottom, 40)
                    }
                    .scrollDismissesKeyboard(.interactively)
                }
            }

            // Saving indicator
            if isSaving {
                VStack {
                    Spacer()
                    HStack(spacing: 8) {
                        ProgressView()
                            .tint(BasemarkTheme.ink)
                        Text("Saving…")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(BasemarkTheme.muted)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(BasemarkTheme.surfaceElevated, in: Capsule())
                    .padding(.bottom, 12)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .animation(.snappy, value: isSaving)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Button {
                        showDeleteConfirmation = true
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(BasemarkTheme.danger)
                            .frame(width: 32, height: 32)
                            .background(BasemarkTheme.surfaceElevated, in: Circle())
                            .overlay {
                                Circle().stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
                            }
                    }
                    .disabled(baseUpdatedAt == nil)

                    Button {
                        showConfig = true
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(BasemarkTheme.ink)
                            .frame(width: 32, height: 32)
                            .background(BasemarkTheme.surfaceElevated, in: Circle())
                            .overlay {
                                Circle().stroke(BasemarkTheme.lineSubtle, lineWidth: 1)
                            }
                    }
                    .disabled(baseUpdatedAt == nil)
                }
                .buttonStyle(.plain)
            }

            ToolbarItemGroup(placement: .keyboard) {
                // Quick-insert strip above keyboard
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Self.quickInserts) { insert in
                            Button {
                                apply(insert.action)
                            } label: {
                                Image(systemName: insert.systemImage)
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(BasemarkTheme.ink)
                                    .frame(width: 36, height: 36)
                                    .background(BasemarkTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Spacer()

                Button("Done") {
                    isBodyFocused = false
                }
                .font(.system(.body, design: .rounded).weight(.semibold))
            }
        }
        .task(id: "\(documentID)-\(appState.reloadToken)") {
            load()
        }
        .onChange(of: draft) { _, _ in
            scheduleSave()
        }
        .onDisappear {
            saveTask?.cancel()
            guard
                !isDeleting,
                deletedDocumentID == nil,
                conflictDocument == nil,
                draft != originalDraft,
                baseUpdatedAt != nil
            else { return }

            Task {
                await saveNow()
            }
        }
        .sheet(isPresented: $showConfig) {
            noteConfigSheet
        }
        .confirmationDialog(
            "Delete this note?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete Note", role: .destructive) {
                Task {
                    await deleteDocument()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the note from Basemark and from the local cache.")
        }
    }

    private func conflictBanner(document: Document) -> some View {
        BasemarkCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Server version changed")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(BasemarkTheme.warning)

                Text("Your local draft no longer matches the latest server copy. Load the server version or overwrite it with your current text.")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(BasemarkTheme.muted)

                HStack(spacing: 10) {
                    Button("Load Server Copy") {
                        applyServerDocument(document)
                    }
                    .buttonStyle(.bordered)

                    Button("Overwrite") {
                        Task {
                            await overwriteConflict()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(BasemarkTheme.warning)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    private func errorBanner(message: String) -> some View {
        BasemarkCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Save issue")
                    .font(.system(.headline, design: .rounded).weight(.bold))
                    .foregroundStyle(BasemarkTheme.warning)

                Text(message)
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(BasemarkTheme.muted)

                Button("Retry now") {
                    Task {
                        await saveNow()
                    }
                }
                .buttonStyle(.bordered)
                .disabled(baseUpdatedAt == nil || isSaving)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    // MARK: - Config sheet

    private var noteConfigSheet: some View {
        NavigationStack {
            ZStack {
                BasemarkTheme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Collection picker
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Collection")
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
                        }

                        // Public toggle
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

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.system(size: 13))
                                .foregroundStyle(BasemarkTheme.warning)
                        }
                    }
                    .padding(20)
                }
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
            .navigationTitle("Note Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showConfig = false
                    }
                    .font(.system(.body, design: .rounded).weight(.semibold))
                }
            }
        }
    }

    // MARK: - Quick inserts

    private struct QuickInsert: Identifiable {
        let id: String
        let systemImage: String
        let action: QuickInsertAction
    }

    private enum QuickInsertAction {
        case prefixLine(String)
        case wrapSelection(prefix: String, suffix: String, placeholder: String)
        case insertBlock(String)
    }

    private static let quickInserts: [QuickInsert] = [
        QuickInsert(id: "heading", systemImage: "textformat.size.larger", action: .prefixLine("# ")),
        QuickInsert(id: "section", systemImage: "textformat.size", action: .prefixLine("## ")),
        QuickInsert(id: "ordered", systemImage: "list.number", action: .prefixLine("1. ")),
        QuickInsert(id: "bullet", systemImage: "list.bullet", action: .prefixLine("- ")),
        QuickInsert(id: "task", systemImage: "checklist", action: .prefixLine("- [ ] ")),
        QuickInsert(id: "quote", systemImage: "text.quote", action: .prefixLine("> ")),
        QuickInsert(id: "code", systemImage: "chevron.left.forwardslash.chevron.right", action: .wrapSelection(prefix: "```\n", suffix: "\n```", placeholder: "code")),
        QuickInsert(id: "divider", systemImage: "minus", action: .insertBlock("---")),
    ]

    // MARK: - Data

    private func load() {
        collections = (try? appState.database.fetchCollections()) ?? []

        guard let document = try? appState.database.fetchDocument(id: documentID) else {
            let hadLoadedDocument = baseUpdatedAt != nil || !originalDraft.isMeaningfullyEmpty
            draft = DocumentDraft()
            originalDraft = DocumentDraft()
            baseUpdatedAt = nil
            selectedRange = NSRange(location: 0, length: 0)
            conflictDocument = nil
            saveTask?.cancel()
            isMissingFromCache = true

            if hadLoadedDocument {
                deletedDocumentID = documentID
            }
            return
        }

        if draft != originalDraft || conflictDocument != nil || isSaving {
            deletedDocumentID = nil
            isMissingFromCache = false
            return
        }

        let loaded = DocumentDraft(document: document)
        draft = loaded
        originalDraft = loaded
        baseUpdatedAt = document.updatedAt
        selectedRange = NSRange(location: (loaded.bodyText as NSString).length, length: 0)
        deletedDocumentID = nil
        isMissingFromCache = false
    }

    // MARK: - Auto-save

    private func scheduleSave() {
        saveTask?.cancel()
        guard
            draft != originalDraft,
            baseUpdatedAt != nil,
            !isDeleting,
            conflictDocument == nil,
            deletedDocumentID == nil
        else { return }

        saveTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await saveNow()
        }
    }

    private func saveNow() async {
        guard
            !isSaving,
            !isDeleting,
            deletedDocumentID == nil,
            conflictDocument == nil,
            draft != originalDraft,
            let baseUpdatedAt
        else { return }

        saveTask?.cancel()
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let result = try await appState.saveDocument(
                documentID: documentID,
                draft: draft,
                baseUpdatedAt: baseUpdatedAt
            )

            switch result {
            case let .saved(document):
                let savedDraft = DocumentDraft(document: document)
                self.draft = savedDraft
                self.originalDraft = savedDraft
                self.baseUpdatedAt = document.updatedAt
                conflictDocument = nil
                deletedDocumentID = nil
                isMissingFromCache = false
            case let .conflict(document):
                self.baseUpdatedAt = document.updatedAt
                conflictDocument = document
                errorMessage = APIError.conflict(document).errorDescription
            }
        } catch {
            errorMessage = AppState.describe(error: error)
        }
    }

    private func deleteDocument() async {
        saveTask?.cancel()
        isDeleting = true

        do {
            try await appState.deleteDocument(id: documentID)
            deletedDocumentID = documentID
            dismiss()
        } catch {
            isDeleting = false
            errorMessage = AppState.describe(error: error)
        }
    }

    private func applyServerDocument(_ document: Document) {
        let serverDraft = DocumentDraft(document: document)
        draft = serverDraft
        originalDraft = serverDraft
        baseUpdatedAt = document.updatedAt
        selectedRange = NSRange(location: (serverDraft.bodyText as NSString).length, length: 0)
        conflictDocument = nil
        errorMessage = nil
        deletedDocumentID = nil
        isMissingFromCache = false
        isBodyFocused = true
    }

    private func overwriteConflict() async {
        conflictDocument = nil
        errorMessage = nil
        await saveNow()
    }

    // MARK: - Quick insert helpers

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

        isBodyFocused = true
    }

    // MARK: - Computed

    private var wordCount: Int {
        draft.normalizedBodyText.split(whereSeparator: \.isWhitespace).count
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

    // MARK: - Text manipulation (same as DocumentEditorView)

    private static func absoluteDate(for timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        return date.formatted(date: .abbreviated, time: .shortened)
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
}
