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
import { nextMenuIndex } from "./editor-helpers";

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

interface CommandItem {
  name: string;
  command: (editor: Editor) => void;
}

const COMMANDS: CommandItem[] = [
  {
    name: "Heading 1",
    command: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: "Heading 2",
    command: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: "Heading 3",
    command: (editor: Editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    name: "Code Block",
    command: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    name: "Mermaid Diagram",
    command: (editor: Editor) =>
      editor.chain().focus().setCodeBlock({ language: "mermaid" }).run(),
  },
  {
    name: "Table",
    command: (editor: Editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    name: "Callout Info",
    command: (editor: Editor) =>
      editor.chain().focus().setCallout("info").run(),
  },
  {
    name: "Callout Warning",
    command: (editor: Editor) =>
      editor.chain().focus().setCallout("warning").run(),
  },
  {
    name: "Callout Tip",
    command: (editor: Editor) =>
      editor.chain().focus().setCallout("tip").run(),
  },
  {
    name: "Task List",
    command: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    name: "Divider",
    command: (editor: Editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    name: "Image",
    command: (editor: Editor) => {
      const url = prompt("Image URL:");
      if (url) editor.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    name: "YouTube",
    command: (editor: Editor) => {
      const url = prompt("YouTube URL:");
      if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
    },
  },
  {
    name: "Highlight",
    command: (editor: Editor) =>
      editor.chain().focus().toggleHighlight().run(),
  },
];

// ---------------------------------------------------------------------------
// Menu component
// ---------------------------------------------------------------------------

interface SlashMenuProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export interface SlashMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
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

    if (items.length === 0) return null;

    return (
      <div className="slash-menu">
        {items.map((item, index) => (
          <div
            key={item.name}
            className={`slash-menu-item${index === selectedIndex ? " is-selected" : ""}`}
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(e) => {
              e.preventDefault();
              selectItem(index);
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    );
  }
);

SlashMenu.displayName = "SlashMenu";

// ---------------------------------------------------------------------------
// Tiptap Extension
// ---------------------------------------------------------------------------

interface SuggestionRenderProps {
  editor: Editor;
  clientRect?: (() => DOMRect | null) | null;
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        allowSpaces: false,
        startOfLine: false,

        command({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) {
          // Delete the slash + any typed query, then run the command
          editor.chain().focus().deleteRange(range).run();
          props.command(editor);
        },

        items({ query }: { query: string }): CommandItem[] {
          if (!query) return COMMANDS;
          return COMMANDS.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          );
        },

        render() {
          let component: ReactRenderer<SlashMenuRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart(props: SuggestionRenderProps) {
              component = new ReactRenderer(SlashMenu, {
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

            onUpdate(props: SuggestionRenderProps) {
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
        pluginKey: new PluginKey("slashCommand"),
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
