import * as fts from "@/lib/db/fts";
import { queryStatement, runStatement } from "@/lib/db";
import { extractText } from "@/lib/text";

type FTSModuleWithRebuild = typeof fts & {
  rebuildFTSFromDocuments?: () => Promise<void>;
};

let indexOperationQueue: Promise<void> = Promise.resolve();

export async function syncDocumentIndex(documentId: string) {
  await runSerializedIndexOperation(() => fts.syncDocumentFTS(documentId));
}

export async function deleteDocumentIndex(documentId: string) {
  await runSerializedIndexOperation(() => fts.deleteDocumentFTS(documentId));
}

export async function rebuildDocumentIndex() {
  await runSerializedIndexOperation(async () => {
    const rebuildFTSFromDocuments = (fts as FTSModuleWithRebuild).rebuildFTSFromDocuments;
    if (rebuildFTSFromDocuments) {
      await rebuildFTSFromDocuments();
      return;
    }

    await runStatement(`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        doc_id UNINDEXED,
        title,
        content_text,
        tokenize='porter unicode61'
      );
    `);

    await runStatement("DELETE FROM documents_fts");
    const rows = await queryStatement("SELECT id, title, content FROM documents");

    for (const row of rows as Array<{ id: string; title?: unknown; content?: unknown }>) {
      await runStatement(
        "INSERT INTO documents_fts (doc_id, title, content_text) VALUES (?, ?, ?)",
        [
          row.id,
          typeof row.title === "string" && row.title.length > 0 ? row.title : "Untitled",
          toPlainText(typeof row.content === "string" ? row.content : ""),
        ],
      );
    }
  });
}

export async function searchDocumentIndex(query: string, limit?: number) {
  return fts.searchDocuments(query, limit);
}

function toPlainText(content: string): string {
  try {
    return extractText(JSON.parse(content || "{}"));
  } catch {
    return content;
  }
}

function runSerializedIndexOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = indexOperationQueue.catch(() => undefined).then(operation);
  indexOperationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
