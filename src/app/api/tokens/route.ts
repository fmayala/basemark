import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  formatTokenPrefix,
  generateApiToken,
  hashApiToken,
  normalizeTokenScopes,
} from "@/lib/token-security";
import { isNull } from "drizzle-orm";

const createTokenSchema = z.object({
  name: z.string().optional(),
  scope: z.array(z.string().min(1)).optional(),
});

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { allowToken: false });
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createTokenSchema);
  if (validationError) return validationError;

  const id = nanoid();
  const token = generateApiToken();
  const tokenHash = hashApiToken(token);
  const tokenPrefix = formatTokenPrefix(token);
  const name = body.name ?? "Unnamed token";
  let scopeValues: string[];
  try {
    scopeValues = normalizeTokenScopes(body.scope);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token scope";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const scope = scopeValues.join(" ");
  const createdAt = Math.floor(Date.now() / 1000);

  await db.insert(apiTokens).values({
    id,
    tokenHash,
    tokenPrefix,
    name,
    scope,
    createdAt,
  });

  // Return the full token once; only hash/prefix are stored.
  return NextResponse.json({ id, token, name, createdAt }, { status: 201 });
}

export async function GET(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { allowToken: false });
  if (authError) return authError;

  const rows = await db.select().from(apiTokens).where(isNull(apiTokens.revokedAt));
  const redacted = rows.map((row) => ({
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scope: row.scope,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  }));

  return NextResponse.json(redacted);
}
