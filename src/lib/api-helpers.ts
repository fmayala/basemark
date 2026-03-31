import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { isOwnerEmail } from "@/lib/authz";
import {
  createTokensService,
  type ValidateBearerResult,
} from "@/domain/services/tokens-service";
import { parseBearerToken } from "@/lib/bearer-token";

// Dev bypass: skip auth in development when DEV_BYPASS_AUTH=1
const isDevBypass = process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "1";
const tokensService = createTokensService();

type BearerValidationResult = "ok" | "invalid" | "scope_denied";

type RequireAuthOptions = {
  allowBearer?: boolean;
  requiredScopes?: string[];
};

async function validateBearerToken(req: NextRequest, requiredScopes: string[]): Promise<BearerValidationResult> {
  const result = await authenticateBearer(req, requiredScopes);
  return result.status;
}

export async function authenticateBearer(
  req: NextRequest,
  requiredScopes: string[] = [],
): Promise<ValidateBearerResult> {
  const token = parseBearerToken(req.headers.get("authorization"));
  if (!token) return { status: "invalid" };
  return tokensService.validateBearer(token, requiredScopes);
}

export async function isApiAuthenticated(req?: NextRequest): Promise<boolean> {
  if (isDevBypass) return true;
  if (req) {
    const bearerResult = await validateBearerToken(req, []);
    if (bearerResult === "ok") return true;
  }
  const session = await auth();
  if (!session?.user) return false;
  return isOwnerEmail(session.user.email);
}

export async function requireAuth(
  req: NextRequest,
  options: RequireAuthOptions = {},
): Promise<NextResponse | null> {
  if (isDevBypass) return null;
  const allowBearer = options.allowBearer ?? options.requiredScopes !== undefined;
  const requiredScopes = options.requiredScopes ?? [];

  if (allowBearer) {
    const bearerResult = await validateBearerToken(req, requiredScopes);
    if (bearerResult === "ok") return null;
    if (bearerResult === "scope_denied") {
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
