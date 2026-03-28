import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { collections } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { createCollectionSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;
  const rows = await db.select().from(collections).orderBy(asc(collections.sortOrder));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createCollectionSchema);
  if (validationError) return validationError;
  const { name, icon, color, sortOrder } = body;

  const id = nanoid();
  const now = Math.floor(Date.now() / 1000);

  const [collection] = await db
    .insert(collections)
    .values({
      id,
      name,
      icon: icon ?? null,
      color: color ?? null,
      sortOrder: sortOrder ?? 0,
      createdAt: now,
    })
    .returning();

  return NextResponse.json(collection, { status: 201 });
}
