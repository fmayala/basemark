import SwiftUI
import UIKit

struct MarkdownTextView: UIViewRepresentable {
    @Binding var text: String
    @Binding var selectedRange: NSRange
    @Binding var isFocused: Bool

    /// When true the text view disables its own scroll and grows to fit content,
    /// deferring scrolling to a parent ScrollView. Set false when used standalone.
    var growsWithContent: Bool = true

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.delegate = context.coordinator
        textView.backgroundColor = .clear
        textView.textColor = UIColor(BasemarkTheme.ink)
        textView.font = UIFont.preferredFont(forTextStyle: .body)
        textView.adjustsFontForContentSizeCategory = true
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.autocorrectionType = .yes
        textView.autocapitalizationType = .sentences
        textView.smartDashesType = .no
        textView.smartQuotesType = .no
        textView.smartInsertDeleteType = .no
        textView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        if growsWithContent {
            textView.isScrollEnabled = false
            textView.keyboardDismissMode = .none // parent handles this
        } else {
            textView.isScrollEnabled = true
            textView.keyboardDismissMode = .interactive
        }

        return textView
    }

    func updateUIView(_ textView: UITextView, context: Context) {
        if textView.text != text {
            textView.text = text
            if growsWithContent {
                textView.invalidateIntrinsicContentSize()
            }
        }

        let maxLocation = (textView.text as NSString).length
        let clampedRange = NSRange(
            location: min(selectedRange.location, maxLocation),
            length: min(selectedRange.length, max(0, maxLocation - min(selectedRange.location, maxLocation)))
        )

        if textView.selectedRange != clampedRange {
            textView.selectedRange = clampedRange
        }

        if isFocused, !textView.isFirstResponder {
            textView.becomeFirstResponder()
        } else if !isFocused, textView.isFirstResponder {
            textView.resignFirstResponder()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        private let parent: MarkdownTextView

        init(_ parent: MarkdownTextView) {
            self.parent = parent
        }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
            if parent.growsWithContent {
                textView.invalidateIntrinsicContentSize()
            }
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            parent.selectedRange = textView.selectedRange
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            parent.isFocused = true
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            parent.isFocused = false
            parent.selectedRange = textView.selectedRange
        }
    }
}
