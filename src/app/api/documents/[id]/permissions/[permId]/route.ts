import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { documentPermissions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; permId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id, permId } = await params;

  const [deleted] = await db
    .delete(documentPermissions)
    .where(
      and(
        eq(documentPermissions.id, permId),
        eq(documentPermissions.documentId, id),
      ),
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
