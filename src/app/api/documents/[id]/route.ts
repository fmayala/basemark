import { NextRequest, NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { updateDocumentSchema } from "@/lib/validation";
import { tiptapJsonToMarkdown } from "@/lib/markdown";
import { createDocumentsService } from "@/domain/services/documents-service";
import { createSearchIndexService } from "@/domain/services/search-index-service";

type Params = { params: Promise<{ id: string }> };

const searchIndexService = createSearchIndexService();

function logDegradedIndexStatus(
  operation: "sync_document" | "delete_document",
  documentId: string,
  result: Awaited<ReturnType<typeof searchIndexService.syncDocument>>,
) {
  if (result.status !== "degraded") return;
  console.warn("search_index_degraded", {
    operation,
    documentId,
    reason: result.reason,
  });
}

const documentsService = createDocumentsService({
  searchIndex: {
    syncDocument: async (documentId) => {
      const result = await searchIndexService.syncDocument(documentId);
      logDegradedIndexStatus("sync_document", documentId, result);
    },
    removeDocument: async (documentId) => {
      const result = await searchIndexService.deleteDocument(documentId);
      logDegradedIndexStatus("delete_document", documentId, result);
    },
  },
});

export async function GET(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:read"] });
  if (authError) return authError;

  const { id } = await params;
  const doc = await documentsService.getDocumentById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (format === "markdown" && doc.content) {
    try {
      const parsed = JSON.parse(doc.content);
      const markdownText = tiptapJsonToMarkdown(parsed);
      return new NextResponse(markdownText, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    } catch {
      // Fall through to JSON response
    }
  }

  return NextResponse.json(doc);
}

export async function PUT(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:write"] });
  if (authError) return authError;

  const { id } = await params;
  const [body, validationError] = await validateBody(req, updateDocumentSchema);
  if (validationError) return validationError;
  const { title, content, collectionId, sortOrder, isPublic } = body;
  const doc = await documentsService.updateDocument(id, {
    title,
    content,
    collectionId,
    sortOrder,
    isPublic,
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:write"] });
  if (authError) return authError;

  const { id } = await params;
  const result = await documentsService.deleteDocument(id);
  if (!result.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
