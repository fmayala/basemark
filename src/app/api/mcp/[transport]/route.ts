import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { db, dbReady } from "@/lib/db";
import { documents, collections, documentPermissions, apiTokens } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { searchDocuments } from "@/lib/db/fts";
import { syncDocumentFTS, deleteDocumentFTS } from "@/lib/db/fts";
import { NextRequest } from "next/server";
import { hashApiToken, parseTokenScopes, tokenHasScopes } from "@/lib/token-security";
import {
  mcpCreateCollectionInputSchema,
  mcpCreateDocInputSchema,
  mcpShareInputSchema,
  mcpUpdateDocInputSchema,
} from "@/lib/mcp-constraints";

async function validateBearerToken(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer bm_")) return false;
  const token = authHeader.slice(7); // "Bearer " is 7 chars
  await dbReady;
  const tokenHash = hashApiToken(token);
  const row = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .get();
  if (!row) return false;
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt < Math.floor(Date.now() / 1000)) return false;

  const scopes = parseTokenScopes(row.scope);
  if (!tokenHasScopes(scopes, ["mcp:access"])) return false;

  // Update last_used_at fire-and-forget
  db.update(apiTokens)
    .set({ lastUsedAt: Math.floor(Date.now() / 1000) })
    .where(eq(apiTokens.id, row.id))
    .run();
  return true;
}

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
        const results = await searchDocuments(query);
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
        inputSchema: {
          title: z.string().describe("Document title"),
          content: z.string().optional().describe("Document content (Tiptap JSON or plain text)"),
          collectionId: z.string().optional().describe("Collection ID to assign the document to"),
        },
      },
      async ({ title, content, collectionId }) => {
        const parsedCreate = mcpCreateDocInputSchema.parse({ title, content, collectionId });
        await dbReady;
        const id = nanoid();
        const now = Math.floor(Date.now() / 1000);

        const [doc] = await db
          .insert(documents)
          .values({
            id,
            title: parsedCreate.title,
            content: parsedCreate.content ?? "",
            collectionId: parsedCreate.collectionId ?? null,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await syncDocumentFTS(id, doc.title);

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
        inputSchema: {
          id: z.string().describe("Document ID"),
          title: z.string().optional().describe("New title"),
          content: z.string().optional().describe("New content"),
        },
      },
      async ({ id, title, content }) => {
        const parsedUpdate = mcpUpdateDocInputSchema.parse({ id, title, content });
        await dbReady;
        const updates: Record<string, unknown> = {};
        const now = Math.floor(Date.now() / 1000);
        if (parsedUpdate.title !== undefined) {
          updates.title = parsedUpdate.title;
          updates.updatedAt = now;
        }
        if (parsedUpdate.content !== undefined) {
          updates.content = parsedUpdate.content;
          updates.updatedAt = now;
        }

        if (Object.keys(updates).length === 0) {
          const doc = await db
            .select()
            .from(documents)
            .where(eq(documents.id, parsedUpdate.id))
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
        }

        const [doc] = await db
          .update(documents)
          .set(updates)
          .where(eq(documents.id, parsedUpdate.id))
          .returning();

        if (!doc) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }],
            isError: true,
          };
        }

        await syncDocumentFTS(parsedUpdate.id, doc.title);

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
        await deleteDocumentFTS(id);
        const [doc] = await db
          .delete(documents)
          .where(eq(documents.id, id))
          .returning();
        if (!doc) {
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
        inputSchema: {
          name: z.string().describe("Collection name"),
        },
      },
      async ({ name }) => {
        const parsedCollection = mcpCreateCollectionInputSchema.parse({ name });
        await dbReady;
        const id = nanoid();
        const now = Math.floor(Date.now() / 1000);

        const [collection] = await db
          .insert(collections)
          .values({
            id,
            name: parsedCollection.name,
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
        inputSchema: {
          id: z.string().describe("Document ID"),
          isPublic: z
            .boolean()
            .optional()
            .describe("Set document public visibility"),
          inviteEmail: z
            .string()
            .optional()
            .describe("Email address to invite as a viewer"),
        },
      },
      async ({ id, isPublic, inviteEmail }) => {
        const parsedShare = mcpShareInputSchema.parse({ id, isPublic, inviteEmail });
        await dbReady;
        let doc = await db
          .select()
          .from(documents)
          .where(eq(documents.id, parsedShare.id))
          .get();
        if (!doc) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }],
            isError: true,
          };
        }

        // Update isPublic if provided
        if (parsedShare.isPublic !== undefined) {
          const [updated] = await db
            .update(documents)
            .set({ isPublic: parsedShare.isPublic })
            .where(eq(documents.id, parsedShare.id))
            .returning();
          doc = updated;
        }

        // Add permission for invited email if provided
        let permission = null;
        if (parsedShare.inviteEmail) {
          const permId = nanoid();
          const now = Math.floor(Date.now() / 1000);
          const [perm] = await db
            .insert(documentPermissions)
            .values({
              id: permId,
              documentId: parsedShare.id,
              email: parsedShare.inviteEmail,
              role: "viewer",
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: [documentPermissions.documentId, documentPermissions.email],
              set: { role: "viewer" },
            })
            .returning();
          permission = perm;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ doc, permission }),
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

  const isValid = await validateBearerToken(req);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
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
