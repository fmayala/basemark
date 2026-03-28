import { generateJSON } from "@tiptap/core";
import MarkdownIt from "markdown-it";
import serverExtensions from "./server-extensions";

// ---------------------------------------------------------------------------
// Tiptap JSON → Markdown
// ---------------------------------------------------------------------------

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

function applyMarks(text: string, marks: TiptapMark[]): string {
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `**${result}**`;
        break;
      case "italic":
        result = `*${result}*`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "link": {
        const href = (mark.attrs?.href as string) ?? "";
        result = `[${result}](${href})`;
        break;
      }
      case "strike":
        result = `~~${result}~~`;
        break;
      case "underline":
        result = `<u>${result}</u>`;
        break;
      default:
        break;
    }
  }
  return result;
}

function nodeToMarkdown(node: TiptapNode, listDepth = 0, ordered = false, index = 0): string {
  switch (node.type) {
    case "doc": {
      return (node.content ?? []).map((child) => nodeToMarkdown(child)).join("");
    }

    case "text": {
      const raw = node.text ?? "";
      if (!node.marks || node.marks.length === 0) return raw;
      return applyMarks(raw, node.marks);
    }

    case "hardBreak": {
      return "\n";
    }

    case "horizontalRule": {
      return "---\n\n";
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const text = (node.content ?? []).map((child) => nodeToMarkdown(child)).join("");
      return `${"#".repeat(level)} ${text}\n\n`;
    }

    case "paragraph": {
      const text = (node.content ?? []).map((child) => nodeToMarkdown(child)).join("");
      if (!text.trim()) return "\n";
      return `${text}\n\n`;
    }

    case "bulletList": {
      return (
        (node.content ?? [])
          .map((item) => nodeToMarkdown(item, listDepth, false))
          .join("") + (listDepth === 0 ? "\n" : "")
      );
    }

    case "orderedList": {
      return (
        (node.content ?? [])
          .map((item, i) => nodeToMarkdown(item, listDepth, true, i + 1))
          .join("") + (listDepth === 0 ? "\n" : "")
      );
    }

    case "listItem": {
      const prefix = ordered ? `${index}. ` : "- ";
      const indent = "  ".repeat(listDepth);
      const children = node.content ?? [];

      const lines: string[] = [];
      for (const child of children) {
        if (child.type === "paragraph") {
          const text = (child.content ?? [])
            .map((c) => nodeToMarkdown(c))
            .join("");
          lines.push(`${indent}${prefix}${text}`);
        } else if (child.type === "bulletList" || child.type === "orderedList") {
          lines.push(nodeToMarkdown(child, listDepth + 1, child.type === "orderedList"));
        } else {
          lines.push(nodeToMarkdown(child, listDepth + 1));
        }
      }
      return lines.join("\n") + "\n";
    }

    case "taskList": {
      return (
        (node.content ?? [])
          .map((item) => nodeToMarkdown(item, listDepth, false))
          .join("") + (listDepth === 0 ? "\n" : "")
      );
    }

    case "taskItem": {
      const checked = !!(node.attrs?.checked);
      const checkbox = checked ? "- [x] " : "- [ ] ";
      const indent = "  ".repeat(listDepth);
      const children = node.content ?? [];
      const lines: string[] = [];

      for (const child of children) {
        if (child.type === "paragraph") {
          const text = (child.content ?? [])
            .map((c) => nodeToMarkdown(c))
            .join("");
          lines.push(`${indent}${checkbox}${text}`);
        } else if (child.type === "taskList" || child.type === "bulletList" || child.type === "orderedList") {
          lines.push(nodeToMarkdown(child, listDepth + 1));
        } else {
          lines.push(nodeToMarkdown(child, listDepth + 1));
        }
      }
      return lines.join("\n") + "\n";
    }

    case "codeBlock": {
      const language = (node.attrs?.language as string) ?? "";
      const code = (node.content ?? [])
        .map((child) => child.text ?? "")
        .join("");
      return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    case "blockquote": {
      const inner = (node.content ?? [])
        .map((child) => nodeToMarkdown(child))
        .join("");
      return (
        inner
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n")
          .replace(/>\s*$/, "")
          .trimEnd() + "\n\n"
      );
    }

    case "callout": {
      const calloutType = ((node.attrs?.type as string) ?? "info");
      const label = calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
      const inner = (node.content ?? [])
        .map((child) => nodeToMarkdown(child))
        .join("")
        .trimEnd();
      const prefixed = `**${label}:** ${inner}`;
      return (
        prefixed
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n") + "\n\n"
      );
    }

    case "image": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      return `![${alt}](${src})\n\n`;
    }

    case "table": {
      const rows = node.content ?? [];
      if (rows.length === 0) return "";

      const renderRow = (row: TiptapNode): string[] => {
        return (row.content ?? []).map((cell) => {
          const text = (cell.content ?? [])
            .map((child) => nodeToMarkdown(child))
            .join("")
            .replace(/\n+/g, " ")
            .trim();
          return text;
        });
      };

      const headerRow = renderRow(rows[0]);
      const separator = headerRow.map(() => "---");

      const mdRows: string[] = [];
      mdRows.push(`| ${headerRow.join(" | ")} |`);
      mdRows.push(`| ${separator.join(" | ")} |`);

      for (let i = 1; i < rows.length; i++) {
        const cells = renderRow(rows[i]);
        mdRows.push(`| ${cells.join(" | ")} |`);
      }

      return mdRows.join("\n") + "\n\n";
    }

    default: {
      // Fallback: recurse into children
      if (node.content) {
        return node.content.map((child) => nodeToMarkdown(child)).join("");
      }
      return node.text ?? "";
    }
  }
}

export function tiptapJsonToMarkdown(json: TiptapNode): string {
  return nodeToMarkdown(json).trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// Markdown → Tiptap JSON
// ---------------------------------------------------------------------------

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export function markdownToTiptapJson(markdown: string): unknown {
  const html = md.render(markdown);
  return generateJSON(html, serverExtensions);
}
