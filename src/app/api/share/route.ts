import { NextRequest, NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { createShareSchema } from "@/lib/validation";
import { createSharingService } from "@/domain/services/sharing-service";

const sharingService = createSharingService();

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:write"] });
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createShareSchema);
  if (validationError) return validationError;
  const { documentId, expiresAt } = body;

  const result = await sharingService.createShareLink({ documentId, expiresAt });
  if (!result.ok) {
    if (result.reason === "invalid_expires_at") {
      return NextResponse.json({ error: "Invalid expiresAt timestamp" }, { status: 400 });
    }
    if (result.reason === "expires_in_past") {
      return NextResponse.json({ error: "expiresAt must be in the future" }, { status: 400 });
    }
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ token: result.token, url: result.url }, { status: 201 });
}
