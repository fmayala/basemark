"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { readOnlyExtensions } from "@/components/editor/extensions";
import { parseEditorContent } from "@/components/editor/editor-content";

export default function SharedDocView({ content }: { content: string }) {
  const editor = useEditor({
    extensions: readOnlyExtensions,
    content: parseEditorContent(content),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "basemark-editor",
      },
    },
  });

  return <EditorContent editor={editor} />;
}
