import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { requireAuth, validateBody } from "@/lib/api-helpers";
import { hashToken } from "@/domain/repos/tokens-repo";
import { nanoid } from "nanoid";
import { z } from "zod";

const allowedScopes = ["documents:read", "documents:write", "mcp:invoke"] as const;

const createTokenSchema = z.object({
  name: z.string().optional(),
  scopes: z.array(z.enum(allowedScopes)).optional(),
});

export async function POST(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { allowBearer: false });
  if (authError) return authError;

  const [body, validationError] = await validateBody(req, createTokenSchema);
  if (validationError) return validationError;

  const id = nanoid();
  const token = "bm_" + nanoid(32);
  const tokenHash = hashToken(token);
  const name = body.name ?? "Unnamed token";
  const scope = body.scopes && body.scopes.length > 0 ? body.scopes.join(" ") : "documents:read";
  const createdAt = Math.floor(Date.now() / 1000);

  await db.insert(apiTokens).values({ id, tokenHash, name, scope, createdAt });

  return NextResponse.json({ id, token, name, createdAt }, { status: 201 });
}

export async function GET(req: NextRequest) {
  await dbReady;
  const authError = await requireAuth(req, { allowBearer: false });
  if (authError) return authError;

  const rows = await db.select().from(apiTokens);
  const redacted = rows.map(({ id, name, tokenHash, createdAt, lastUsedAt, scope }) => ({
    id,
    name,
    tokenPrefix: tokenHash.slice(0, 11) + "...",
    scope,
    createdAt,
    lastUsedAt,
  }));

  return NextResponse.json(redacted);
}
