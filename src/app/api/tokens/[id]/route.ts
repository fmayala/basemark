import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const [deleted] = await db.delete(apiTokens).where(eq(apiTokens.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
