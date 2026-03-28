import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { documentPermissions, documents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { nanoid } from "nanoid";
import { createPermissionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;

  // Verify document exists
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const perms = await db
    .select()
    .from(documentPermissions)
    .where(eq(documentPermissions.documentId, id));

  return NextResponse.json(perms);
}

export async function POST(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;

  // Verify document exists
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
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

  await db
    .insert(documentPermissions)
    .values(perm)
    .onConflictDoUpdate({
      target: [documentPermissions.documentId, documentPermissions.email],
      set: {
        role: perm.role,
        createdAt: perm.createdAt,
      },
    });

  const saved = await db
    .select()
    .from(documentPermissions)
    .where(
      and(
        eq(documentPermissions.documentId, id),
        eq(documentPermissions.email, body.email),
      ),
    )
    .get();

  if (!saved) {
    return NextResponse.json({ error: "Failed to save permission" }, { status: 500 });
  }

  return NextResponse.json(saved, { status: 201 });
}
