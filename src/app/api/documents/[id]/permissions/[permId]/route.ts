import { NextRequest, NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { deletePermissionById } from "@/domain/repos/permissions-repo";

type Params = { params: Promise<{ id: string; permId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:write"] });
  if (authError) return authError;

  const { id, permId } = await params;
  const deleted = await deletePermissionById(id, permId);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
