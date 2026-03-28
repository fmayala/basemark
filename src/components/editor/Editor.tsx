"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback } from "react";
import extensions from "./extensions";
import { parseEditorContent } from "./editor-content";

interface EditorProps {
  content: string;
  onUpdate: (content: string) => void;
  docId?: string;
  onReady?: (editor: any) => void;
}

export default function Editor({ content, onUpdate, docId, onReady }: EditorProps) {
  const lastDocIdRef = useRef<string | null>(null);
  const normalizedDocId = docId ?? null;

  const editor = useEditor({
    extensions,
    content: parseEditorContent(content),
    onUpdate: ({ editor: ed }) => {
      onUpdate(JSON.stringify(ed.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "basemark-editor",
      },
    },
    immediatelyRender: false,
  });

  // Sync content only when docId changes
  useEffect(() => {
    if (editor && normalizedDocId !== lastDocIdRef.current) {
      editor.commands.setContent(parseEditorContent(content));
      lastDocIdRef.current = normalizedDocId;
    }
  }, [content, editor, normalizedDocId]);

  // Expose editor instance
  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  // Bubble menu: show when text is selected
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);
  const [, forceUpdate] = useState(0);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const handleBlur = useCallback(() => {
    setBubblePos(null);
  }, []);

  const updateBubble = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      setBubblePos(null);
      return;
    }
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const midX = (start.left + end.left) / 2;
    const top = start.top - 8;
    setBubblePos({ top, left: midX });
    forceUpdate((n) => n + 1);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("selectionUpdate", updateBubble);
    editor.on("blur", handleBlur);
    return () => {
      editor.off("selectionUpdate", updateBubble);
      editor.off("blur", handleBlur);
    };
  }, [editor, handleBlur, updateBubble]);

  return (
    <div style={{ position: "relative" }}>
      <EditorContent editor={editor} />
      {editor && bubblePos && (
        <div
          ref={bubbleRef}
          style={{
            position: "fixed",
            top: bubblePos.top,
            left: bubblePos.left,
            transform: "translate(-50%, -100%)",
            zIndex: 50,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-0.5 bg-bg-sidebar border border-border-subtle rounded-lg px-1 py-0.5 shadow-lg">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`px-2 py-1 rounded text-sm font-bold ${editor.isActive("bold") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              B
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`px-2 py-1 rounded text-sm italic ${editor.isActive("italic") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              I
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`px-2 py-1 rounded text-sm underline ${editor.isActive("underline") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              U
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`px-2 py-1 rounded text-sm line-through ${editor.isActive("strike") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              S
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`px-2 py-1 rounded text-sm font-mono ${editor.isActive("code") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              {"<>"}
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              className={`px-2 py-1 rounded text-sm ${editor.isActive("highlight") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              H
            </button>
            <button
              onClick={() => {
                const url = prompt("Link URL:");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              className={`px-2 py-1 rounded text-sm ${editor.isActive("link") ? "bg-bg-hover text-text-primary" : "text-text-faint hover:text-text-primary"}`}
            >
              Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
