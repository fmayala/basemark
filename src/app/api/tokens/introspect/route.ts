import { NextRequest, NextResponse } from "next/server";

import { authenticateBearer } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const auth = await authenticateBearer(req);
  if (auth.status !== "ok") {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    tokenId: auth.token.id,
    scopes: auth.token.scope
      .split(/[\s,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
    expiresAt: auth.token.expiresAt,
    createdAt: auth.token.createdAt,
  });
}
