import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { updateCollectionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const [collection] = await db.select().from(collections).where(eq(collections.id, id));
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(collection);
}

export async function PUT(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const [body, validationError] = await validateBody(req, updateCollectionSchema);
  if (validationError) return validationError;
  const { name, icon, color, sortOrder } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (icon !== undefined) updates.icon = icon;
  if (color !== undefined) updates.color = color;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  if (Object.keys(updates).length === 0) {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(collection);
  }

  const [collection] = await db
    .update(collections)
    .set(updates)
    .where(eq(collections.id, id))
    .returning();

  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(collection);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const [collection] = await db
    .delete(collections)
    .where(eq(collections.id, id))
    .returning();

  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
