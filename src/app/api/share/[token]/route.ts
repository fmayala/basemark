import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { shareLinks, documents, documentPermissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { isOwnerEmail } from "@/lib/authz";
import { normalizeEmail } from "@/lib/email";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  await dbReady;
  const { token } = await params;

  // 1. Try share_links token first (existing behavior)
  const link = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .get();

  if (link) {
    if (link.expiresAt && link.expiresAt < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }
    const doc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, link.documentId))
      .get();
    if (doc) return NextResponse.json(doc);
  }

  // 2. Try as document ID — public access
  const doc = await db
    .select()
    .from(documents)
    .where(eq(documents.id, token))
    .get();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.isPublic) {
    return NextResponse.json(doc);
  }

  // 3. Check if signed-in user has permission
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  // Owner always has access
  if (isOwnerEmail(session.user.email)) {
    return NextResponse.json(doc);
  }

  const normalizedEmail = normalizeEmail(session.user.email);

  const perm = await db
    .select()
    .from(documentPermissions)
    .where(
      and(
        eq(documentPermissions.documentId, doc.id),
        eq(documentPermissions.email, normalizedEmail)
      )
    )
    .get();

  if (perm) {
    return NextResponse.json(doc);
  }

  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}
