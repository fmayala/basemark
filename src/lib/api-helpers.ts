import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { isOwnerEmail } from "@/lib/authz";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiToken, parseTokenScopes, tokenHasScopes } from "@/lib/token-security";

// Dev bypass: skip auth in development when DEV_BYPASS_AUTH=1
const isDevBypass = process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "1";

type RequireAuthOptions = {
  requiredScopes?: string[];
  allowToken?: boolean;
};

type BearerValidationResult = "ok" | "invalid" | "scope_denied";

async function validateBearerToken(
  req: NextRequest,
  requiredScopes: string[],
): Promise<BearerValidationResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer bm_")) return "invalid";
  const token = authHeader.slice(7); // "Bearer " is 7 chars
  await dbReady;
  const tokenHash = hashApiToken(token);
  const row = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .get();
  if (!row) return "invalid";
  if (row.revokedAt) return "invalid";
  if (row.expiresAt && row.expiresAt < Math.floor(Date.now() / 1000)) return "invalid";

  const scopes = parseTokenScopes(row.scope);
  if (!tokenHasScopes(scopes, requiredScopes)) return "scope_denied";

  // Update last_used_at fire-and-forget
  db.update(apiTokens).set({ lastUsedAt: Math.floor(Date.now() / 1000) }).where(eq(apiTokens.id, row.id)).run();
  return "ok";
}

export async function isApiAuthenticated(req?: NextRequest): Promise<boolean> {
  if (isDevBypass) return true;
  if (req && (await validateBearerToken(req, [])) === "ok") return true;
  const session = await auth();
  if (!session?.user) return false;
  return isOwnerEmail(session.user.email);
}

export async function requireAuth(
  req: NextRequest,
  options: RequireAuthOptions = {},
): Promise<NextResponse | null> {
  const { requiredScopes = [], allowToken = true } = options;
  if (isDevBypass) return null;

  if (allowToken) {
    const tokenResult = await validateBearerToken(req, requiredScopes);
    if (tokenResult === "ok") return null;
    if (tokenResult === "scope_denied") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOwnerEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Parses the request body as JSON and validates against the given zod schema.
 * Returns [data, null] on success or [null, NextResponse] on failure.
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
): Promise<[T, null] | [null, NextResponse]> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return [null, NextResponse.json({ error: "Invalid JSON" }, { status: 400 })];
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return [null, NextResponse.json({ error: result.error.flatten() }, { status: 400 })];
  }
  return [result.data, null];
}
