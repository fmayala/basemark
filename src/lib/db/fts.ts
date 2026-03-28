import { runStatement, queryStatement } from "./index";
import { extractText } from "@/lib/text";

const docOperationQueue = new Map<string, Promise<void>>();

async function ensureFTS() {
  await runStatement(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      doc_id UNINDEXED,
      title,
      content_text,
      tokenize='porter unicode61'
    );
  `);
}

export async function syncDocumentFTS(docId: string, _title?: string, _plainText?: string) {
  await runSerializedByDoc(docId, async () => {
    await ensureFTS();

    const snapshot = await readCurrentDocumentSnapshot(docId);

    await runStatement("DELETE FROM documents_fts WHERE doc_id = ?", [docId]);
    if (!snapshot) return;

    await runStatement(
      "INSERT INTO documents_fts (doc_id, title, content_text) VALUES (?, ?, ?)",
      [docId, snapshot.title, snapshot.plainText],
    );
  });
}

export async function deleteDocumentFTS(docId: string) {
  await runSerializedByDoc(docId, async () => {
    await ensureFTS();
    await runStatement("DELETE FROM documents_fts WHERE doc_id = ?", [docId]);
  });
}

export interface FTSResult {
  id: string;
  title: string;
  snippet: string;
}

export async function searchDocuments(query: string, limit: number = 20): Promise<FTSResult[]> {
  await ensureFTS();
  const sanitized = '"' + query.replace(/"/g, '""') + '"*';
  const rows = await queryStatement(`
    SELECT doc_id as id, title,
      snippet(documents_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
    FROM documents_fts
    WHERE documents_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `, [sanitized, limit]);
  return rows as FTSResult[];
}

function runSerializedByDoc(docId: string, operation: () => Promise<void>): Promise<void> {
  const previous = docOperationQueue.get(docId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  docOperationQueue.set(docId, next);
  return next.finally(() => {
    if (docOperationQueue.get(docId) === next) {
      docOperationQueue.delete(docId);
    }
  });
}

async function readCurrentDocumentSnapshot(
  docId: string,
): Promise<{ title: string; plainText: string } | null> {
  const rows = await queryStatement(
    "SELECT title, content FROM documents WHERE id = ? LIMIT 1",
    [docId],
  );

  const row = rows[0] as { title?: unknown; content?: unknown } | undefined;
  if (!row) return null;

  const title = typeof row.title === "string" && row.title.length > 0 ? row.title : "Untitled";
  const content = typeof row.content === "string" ? row.content : "";

  let plainText = "";
  try {
    plainText = extractText(JSON.parse(content || "{}"));
  } catch {
    plainText = content;
  }

  return { title, plainText };
}
