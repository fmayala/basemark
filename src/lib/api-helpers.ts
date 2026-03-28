import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { isOwnerEmail } from "@/lib/authz";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Dev bypass: skip auth in development when DEV_BYPASS_AUTH=1
const isDevBypass = process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "1";

async function validateBearerToken(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer bm_")) return false;
  const token = authHeader.slice(7); // "Bearer " is 7 chars
  await dbReady;
  const row = await db.select().from(apiTokens).where(eq(apiTokens.token, token)).get();
  if (!row) return false;
  // Update last_used_at fire-and-forget
  db.update(apiTokens).set({ lastUsedAt: Math.floor(Date.now() / 1000) }).where(eq(apiTokens.id, row.id)).run();
  return true;
}

export async function isApiAuthenticated(req?: NextRequest): Promise<boolean> {
  if (isDevBypass) return true;
  if (req && await validateBearerToken(req)) return true;
  const session = await auth();
  if (!session?.user) return false;
  return isOwnerEmail(session.user.email);
}

export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  if (isDevBypass) return null;
  if (await validateBearerToken(req)) return null;
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
