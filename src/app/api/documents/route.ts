import { NextRequest, NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { createDocumentSchema } from "@/lib/validation";
import { createDocumentsService } from "@/domain/services/documents-service";
import { createSearchIndexService } from "@/domain/services/search-index-service";

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

export async function GET(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:read"] });
  if (authError) return authError;

  const includeContent = req.nextUrl.searchParams.get("includeContent") === "1";
  const rows = await documentsService.listDocuments({ includeContent });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:write"] });
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createDocumentSchema);
  if (validationError) return validationError;
  const { title, content, collectionId, sortOrder, isPublic } = body;
  const doc = await documentsService.createDocument({
    title,
    content,
    collectionId,
    sortOrder,
    isPublic,
  });

  return NextResponse.json(doc, { status: 201 });
}
