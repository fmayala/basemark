import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { nanoid } from "nanoid";
import { z } from "zod";

const createTokenSchema = z.object({
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createTokenSchema);
  if (validationError) return validationError;

  const id = nanoid();
  const token = "bm_" + nanoid(32);
  const name = body.name ?? "Unnamed token";
  const createdAt = Math.floor(Date.now() / 1000);

  await db.insert(apiTokens).values({ id, token, name, createdAt });

  return NextResponse.json({ id, token, name, createdAt }, { status: 201 });
}

export async function GET(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req);
  if (authError) return authError;

  const rows = await db.select().from(apiTokens);
  const redacted = rows.map(({ id, name, token, createdAt, lastUsedAt }) => ({
    id,
    name,
    tokenPrefix: token.slice(0, 11) + "...",
    createdAt,
    lastUsedAt,
  }));

  return NextResponse.json(redacted);
}
