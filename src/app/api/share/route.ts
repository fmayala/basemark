import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { shareLinks, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { createShareSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createShareSchema);
  if (validationError) return validationError;
  const { documentId, expiresAt } = body;
  const now = Math.floor(Date.now() / 1000);

  let expiresAtSeconds: number | null = null;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    const timestamp = parsed.getTime();
    if (Number.isNaN(timestamp)) {
      return NextResponse.json({ error: "Invalid expiresAt timestamp" }, { status: 400 });
    }
    expiresAtSeconds = Math.floor(timestamp / 1000);
    if (expiresAtSeconds <= now) {
      return NextResponse.json({ error: "expiresAt must be in the future" }, { status: 400 });
    }
  }

  // Verify document exists
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const id = nanoid();
  const token = nanoid(16);

  const [shareLink] = await db
    .insert(shareLinks)
    .values({
      id,
      documentId,
      token,
      expiresAt: expiresAtSeconds,
      createdAt: now,
    })
    .returning();

  return NextResponse.json(
    { token: shareLink.token, url: `/share/${shareLink.token}` },
    { status: 201 }
  );
}
