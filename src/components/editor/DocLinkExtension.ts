"use client";

import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { buildDocLinkContent, nextMenuIndex } from "./editor-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocItem {
  id: string;
  title: string;
}

interface DocLinkMenuProps {
  items: DocItem[];
  command: (item: DocItem) => void;
}

export interface DocLinkMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

// ---------------------------------------------------------------------------
// Menu component
// ---------------------------------------------------------------------------

const DocLinkMenu = forwardRef<DocLinkMenuRef, DocLinkMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent) {
        if (items.length === 0) return false;

        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => nextMenuIndex(i, "up", items.length));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => nextMenuIndex(i, "down", items.length));
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return React.createElement(
        "div",
        { className: "slash-menu" },
        React.createElement(
          "div",
          {
            style: {
              padding: "6px 12px",
              fontSize: "11px",
              color: "var(--color-text-faint)",
            },
          },
          "No documents found",
        ),
      );
    }

    return React.createElement(
      "div",
      { className: "slash-menu" },
      items.map((item, index) =>
        React.createElement(
          "div",
          {
            key: item.id,
            className: `slash-menu-item${index === selectedIndex ? " is-selected" : ""}`,
            onMouseEnter: () => setSelectedIndex(index),
            onMouseDown: (e: React.MouseEvent) => {
              e.preventDefault();
              selectItem(index);
            },
          },
          item.title || "Untitled",
        ),
      ),
    );
  },
);

DocLinkMenu.displayName = "DocLinkMenu";

// ---------------------------------------------------------------------------
// Fetch documents matching the query
// ---------------------------------------------------------------------------

async function fetchDocItems(query: string): Promise<DocItem[]> {
  try {
    if (query.length < 2) {
      // Return first docs for empty/1-char queries to match search API threshold.
      const res = await fetch("/api/documents");
      if (!res.ok) return [];
      const docs: DocItem[] = await res.json();
      return docs.slice(0, 10);
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const results: DocItem[] = await res.json();
    return results.slice(0, 10);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tiptap Extension
// ---------------------------------------------------------------------------

interface DocLinkRenderProps {
  editor: Editor;
  clientRect?: (() => DOMRect | null) | null;
  items: DocItem[];
  command: (item: DocItem) => void;
}

const DocLinkExtension = Extension.create({
  name: "docLink",

  addOptions() {
    return {
      suggestion: {
        char: "[",
        allowSpaces: false,
        startOfLine: false,

        // Only activate when the previous character is also `[` (i.e. user typed `[[`)
        allow({ state, range }: { state: { doc: { textBetween: (from: number, to: number) => string } }; range: Range }) {
          const { from } = range;
          if (from < 2) return false;
          const prevChar = state.doc.textBetween(from - 1, from);
          return prevChar === "[";
        },

        command({ editor, range, props }: { editor: Editor; range: Range; props: DocItem }) {
          // Extend range back one char to include the leading `[` that triggered activation
          const extendedRange = { from: range.from - 1, to: range.to };
          editor
            .chain()
            .focus()
            .deleteRange(extendedRange)
            .insertContent(buildDocLinkContent(props.id, props.title || "Untitled"))
            .run();
        },

        async items({ query }: { query: string }): Promise<DocItem[]> {
          return fetchDocItems(query);
        },

        render() {
          let component: ReactRenderer<DocLinkMenuRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart(props: DocLinkRenderProps) {
              component = new ReactRenderer(DocLinkMenu, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(props: DocLinkRenderProps) {
              component?.updateProps(props);
              if (!props.clientRect || !popup) return;
              popup[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown({ event }: { event: KeyboardEvent }) {
              if (event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(event) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: new PluginKey("docLink"),
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default DocLinkExtension;
