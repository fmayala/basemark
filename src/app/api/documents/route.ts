import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { desc, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { syncDocumentFTS } from "@/lib/db/fts";
import { extractText } from "@/lib/text";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { createDocumentSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const includeContent = req.nextUrl.searchParams.get("includeContent") === "1";
  const rows = includeContent
    ? await db.select().from(documents).orderBy(asc(documents.sortOrder), desc(documents.updatedAt))
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

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createDocumentSchema);
  if (validationError) return validationError;
  const { title, content, collectionId, sortOrder } = body;

  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  const [doc] = await db
    .insert(documents)
    .values({
      id,
      title: title ?? "Untitled",
      content: content ?? "",
      collectionId: collectionId ?? null,
      sortOrder: sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  let plainText = "";
  try {
    plainText = extractText(JSON.parse(doc.content || "{}"));
  } catch {
    plainText = doc.content || "";
  }

  await syncDocumentFTS(id, doc.title, plainText);

  return NextResponse.json(doc, { status: 201 });
}
