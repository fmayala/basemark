import { NextRequest, NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { nanoid } from "nanoid";
import { createPermissionSchema } from "@/lib/validation";
import { getDocumentRecordById } from "@/domain/repos/documents-repo";
import { listPermissionsForDocument, upsertPermission } from "@/domain/repos/permissions-repo";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:read"] });
  if (authError) return authError;

  const { id } = await params;

  const doc = await getDocumentRecordById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const perms = await listPermissionsForDocument(id);

  return NextResponse.json(perms);
}

export async function POST(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req, { requiredScopes: ["documents:write"] });
  if (authError) return authError;

  const { id } = await params;

  const doc = await getDocumentRecordById(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [body, validationError] = await validateBody(req, createPermissionSchema);
  if (validationError) return validationError;

  const perm = {
    id: nanoid(),
    documentId: id,
    email: body.email,
    role: body.role || "viewer",
    createdAt: Math.floor(Date.now() / 1000),
  };

  const saved = await upsertPermission(perm);

  if (!saved) {
    return NextResponse.json({ error: "Failed to save permission" }, { status: 500 });
  }

  return NextResponse.json(saved, { status: 201 });
}
