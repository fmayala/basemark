import { Extension, generateJSON } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
const MAX_PASTE_LENGTH = 500_000;

/**
 * Intercepts paste events and converts markdown plain text to rich content.
 * Uses markdown-it to render markdown → HTML, then generateJSON to convert
 * HTML → Tiptap JSON using the editor's registered extensions.
 *
 * Detects code editor pastes (VS Code, Cursor) which include rich HTML
 * but where the plain text is the actual markdown source.
 */
export const MarkdownPasteExtension = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(_view, event) {
            // Don't intercept paste inside code blocks — let them paste as plain text
            if (editor.isActive("codeBlock")) return false;

            const types = Array.from(event.clipboardData?.types ?? []);
            const html = event.clipboardData?.getData("text/html") ?? "";
            const text = event.clipboardData?.getData("text/plain") ?? "";

            // Code editors (VS Code, Cursor, etc.) put syntax-highlighted HTML
            // in the clipboard, but the plain text is the actual markdown source.
            const isFromCodeEditor = types.includes("vscode-editor-data") ||
              types.includes("application/vnd.code.copymetadata");

            // If clipboard has real HTML and it's NOT from a code editor,
            // let Tiptap's default HTML parser handle it (e.g. paste from web, Notion)
            if (html && html.trim().length > 10 && !isFromCodeEditor) {
              return false;
            }

            if (!text) return false;
            if (text.length > MAX_PASTE_LENGTH) return false;

            // markdown-it → HTML → generateJSON → insertContent
            try {
              const rendered = md.render(text);
              const json = generateJSON(rendered, editor.extensionManager.extensions);

              editor.commands.insertContent(json, {
                parseOptions: { preserveWhitespace: false },
              });

              return true;
            } catch {
              return false;
            }
          },
        },
      }),
    ];
  },
});
