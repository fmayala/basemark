import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { rebuildFTSFromDocuments } from "@/lib/db/fts";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, { allowToken: false });
  if (authError) return authError;

  await rebuildFTSFromDocuments();
  return NextResponse.json({ success: true });
}
