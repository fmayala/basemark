import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { db, dbReady } from "@/lib/db";
import { documents, collections } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { createDocumentsService } from "@/domain/services/documents-service";
import { createSharingService } from "@/domain/services/sharing-service";
import { createTokensService } from "@/domain/services/tokens-service";
import { searchDocumentIndex } from "@/domain/repos/fts-repo";
import { createSearchIndexService } from "@/domain/services/search-index-service";
import { parseBearerToken } from "@/lib/bearer-token";
import {
  mcpCreateCollectionInputSchema,
  mcpCreateDocInputSchema,
  mcpShareInputSchema,
  mcpUpdateDocInputSchema,
} from "@/lib/mcp-constraints";

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

const sharingService = createSharingService();
const tokensService = createTokensService();

const mcpHandler = createMcpHandler(
  (server) => {
    // 1. search_docs
    server.registerTool(
      "search_docs",
      {
        description: "Search documents using full-text search",
        inputSchema: {
          query: z.string().describe("Search query"),
        },
      },
      async ({ query }) => {
        await dbReady;
        const results = await searchDocumentIndex(query);
        return {
          content: [{ type: "text", text: JSON.stringify(results) }],
        };
      },
    );

    // 2. read_doc
    server.registerTool(
      "read_doc",
      {
        description: "Read a document by ID",
        inputSchema: {
          id: z.string().describe("Document ID"),
        },
      },
      async ({ id }) => {
        await dbReady;
        const doc = await db
          .select()
          .from(documents)
          .where(eq(documents.id, id))
          .get();
        if (!doc) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(doc) }],
        };
      },
    );

    // 3. create_doc
    server.registerTool(
      "create_doc",
      {
        description: "Create a new document",
        inputSchema: mcpCreateDocInputSchema.shape,
      },
      async ({ title, content, collectionId }) => {
        await dbReady;
        const doc = await documentsService.createDocument({
          title,
          content,
          collectionId,
          sortOrder: 0,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(doc) }],
        };
      },
    );

    // 4. update_doc
    server.registerTool(
      "update_doc",
      {
        description: "Update an existing document",
        inputSchema: mcpUpdateDocInputSchema.shape,
      },
      async ({ id, title, content }) => {
        await dbReady;
        const doc = await documentsService.updateDocument(id, { title, content });

        if (!doc) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(doc) }],
        };
      },
    );

    // 5. delete_doc
    server.registerTool(
      "delete_doc",
      {
        description: "Delete a document by ID",
        inputSchema: {
          id: z.string().describe("Document ID"),
        },
      },
      async ({ id }) => {
        await dbReady;
        const result = await documentsService.deleteDocument(id);
        if (!result.success) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, id }) }],
        };
      },
    );

    // 6. list_docs
    server.registerTool(
      "list_docs",
      {
        description: "List all documents, optionally filtered by collection",
        inputSchema: {
          collectionId: z
            .string()
            .optional()
            .describe("Filter by collection ID"),
        },
      },
      async ({ collectionId }) => {
        await dbReady;
        const rows = collectionId
          ? await db
              .select({
                id: documents.id,
                title: documents.title,
                collectionId: documents.collectionId,
                isPublic: documents.isPublic,
                sortOrder: documents.sortOrder,
                createdAt: documents.createdAt,
                updatedAt: documents.updatedAt,
              })
              .from(documents)
              .where(eq(documents.collectionId, collectionId))
              .orderBy(asc(documents.sortOrder), desc(documents.updatedAt))
          : await db
              .select({
                id: documents.id,
                title: documents.title,
                collectionId: documents.collectionId,
                isPublic: documents.isPublic,
                sortOrder: documents.sortOrder,
                createdAt: documents.createdAt,
                updatedAt: documents.updatedAt,
              })
              .from(documents)
              .orderBy(asc(documents.sortOrder), desc(documents.updatedAt));
        return {
          content: [{ type: "text", text: JSON.stringify(rows) }],
        };
      },
    );

    // 7. list_collections
    server.registerTool(
      "list_collections",
      {
        description: "List all collections",
        inputSchema: {},
      },
      async () => {
        await dbReady;
        const rows = await db
          .select()
          .from(collections)
          .orderBy(asc(collections.sortOrder));
        return {
          content: [{ type: "text", text: JSON.stringify(rows) }],
        };
      },
    );

    // 8. create_collection
    server.registerTool(
      "create_collection",
      {
        description: "Create a new collection",
        inputSchema: mcpCreateCollectionInputSchema.shape,
      },
      async ({ name }) => {
        await dbReady;
        const id = nanoid();
        const now = Math.floor(Date.now() / 1000);

        const [collection] = await db
          .insert(collections)
          .values({
            id,
            name,
            sortOrder: 0,
            createdAt: now,
          })
          .returning();

        return {
          content: [{ type: "text", text: JSON.stringify(collection) }],
        };
      },
    );

    // 9. share_doc
    server.registerTool(
      "share_doc",
      {
        description: "Share a document: make it public or invite a user by email",
        inputSchema: mcpShareInputSchema.shape,
      },
      async ({ id, isPublic, inviteEmail }) => {
        await dbReady;
        const result = await sharingService.shareDocument({
          documentId: id,
          isPublic,
          inviteEmail,
        });
        if (!result.ok) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ doc: result.document, permission: result.permission }),
            },
          ],
        };
      },
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 30,
  },
);

async function authMiddleware(req: Request): Promise<Response | null> {
  // Allow dev bypass
  const isDevBypass =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_BYPASS_AUTH === "1";
  if (isDevBypass) return null;

  const token = parseBearerToken(req.headers.get("authorization"));
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await tokensService.validateBearer(token, ["mcp:invoke"]);
  if (result.status === "ok") return null;
  if (result.status === "scope_denied") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const authError = await authMiddleware(req);
  if (authError) return authError;
  return mcpHandler(req);
}

export async function POST(req: NextRequest) {
  const authError = await authMiddleware(req);
  if (authError) return authError;
  return mcpHandler(req);
}
