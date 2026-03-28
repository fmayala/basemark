import StarterKit from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Youtube from "@tiptap/extension-youtube";
// import Focus from "@tiptap/extension-focus";
import CalloutExtension from "./CalloutExtension";
import SlashCommand from "./SlashCommand";
import DocLinkExtension from "./DocLinkExtension";
import { MarkdownPasteExtension } from "./MarkdownPasteExtension";
import { MermaidBlock } from "./MermaidBlock";

const lowlight = createLowlight(common);

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    underline: false,
  }),
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MermaidBlock);
    },
  }).configure({
    lowlight,
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Placeholder.configure({
    placeholder: "Type / for commands...",
  }),
  Typography,
  Underline,
  Link.configure({
    openOnClick: false,
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
  }),
  Highlight.configure({
    multicolor: true,
  }),
  Superscript,
  Subscript,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  TextStyle,
  Color,
  Youtube.configure({
    inline: false,
    ccLanguage: "en",
  }),
  CalloutExtension,
  SlashCommand,
  DocLinkExtension,
  MarkdownPasteExtension,
];

export default extensions;

/**
 * Read-only extensions for rendering documents without interactive editing features.
 * Excludes SlashCommand, DocLinkExtension, and Placeholder.
 */
export const readOnlyExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    underline: false,
  }),
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MermaidBlock);
    },
  }).configure({
    lowlight,
  }),
  Table.configure({
    resizable: false,
  }),
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Typography,
  Underline,
  Link.configure({
    openOnClick: true,
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
  }),
  Highlight.configure({
    multicolor: true,
  }),
  Superscript,
  Subscript,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  TextStyle,
  Color,
  Youtube.configure({
    inline: false,
    ccLanguage: "en",
  }),
  CalloutExtension,
];
