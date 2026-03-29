import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { createSearchIndexService } from "@/domain/services/search-index-service";

const searchIndexService = createSearchIndexService();

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req, { allowBearer: false });
  if (authError) return authError;

  const status = await searchIndexService.rebuild();
  if (status.status === "degraded") {
    return NextResponse.json({ success: false, ...status }, { status: 503 });
  }

  return NextResponse.json({ success: true, ...status });
}
