/**
 * Server-side Tiptap extensions — no React / browser globals.
 * Used by generateJSON in markdown.ts for Node.js / edge runtimes.
 */
import StarterKit from "@tiptap/starter-kit";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import CalloutExtension from "@/components/editor/CalloutExtension";

const lowlight = createLowlight(common);

const serverExtensions = [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    underline: false,
  }),
  CodeBlockLowlight.configure({ lowlight }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem.configure({ nested: true }),
  Underline,
  Link.configure({ openOnClick: false }),
  Image.configure({ inline: false, allowBase64: false }),
  Highlight.configure({ multicolor: true }),
  Superscript,
  Subscript,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color,
  CalloutExtension,
];

export default serverExtensions;
