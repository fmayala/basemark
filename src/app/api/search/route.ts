import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { searchDocuments } from "@/lib/db/fts";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request, { requiredScopes: ["documents:read"] });
  if (authError) return authError;

  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json([]);

  try {
    const results = await searchDocuments(q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json([]);
  }
}
