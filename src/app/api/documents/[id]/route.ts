import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncDocumentFTS, deleteDocumentFTS } from "@/lib/db/fts";
import { extractText } from "@/lib/text";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { updateDocumentSchema } from "@/lib/validation";
import { tiptapJsonToMarkdown } from "@/lib/markdown";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
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
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const [body, validationError] = await validateBody(req, updateDocumentSchema);
  if (validationError) return validationError;
  const { title, content, collectionId, sortOrder, isPublic } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) {
    updates.title = title;
    updates.updatedAt = Math.floor(Date.now() / 1000);
  }
  if (content !== undefined) {
    updates.content = content;
    updates.updatedAt = Math.floor(Date.now() / 1000);
  }
  if (collectionId !== undefined) updates.collectionId = collectionId;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isPublic !== undefined) updates.isPublic = isPublic;

  if (Object.keys(updates).length === 0) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(doc);
  }

  const [doc] = await db
    .update(documents)
    .set(updates)
    .where(eq(documents.id, id))
    .returning();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.select().from(documents).where(eq(documents.id, id)).get();
  if (updated) {
    let plainText = "";
    try {
      plainText = extractText(JSON.parse(updated.content || "{}"));
    } catch {
      plainText = updated.content || "";
    }
    await syncDocumentFTS(id, updated.title, plainText).catch(() => {
      // best-effort; maintenance reindex can repair FTS drift
    });
  }

  return NextResponse.json(doc);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;

  const [doc] = await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteDocumentFTS(id).catch(() => {
    // best-effort; maintenance reindex can repair FTS drift
  });

  return NextResponse.json({ success: true });
}
