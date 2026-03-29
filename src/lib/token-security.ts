import { createHash } from "node:crypto";
import { nanoid } from "nanoid";

export const DEFAULT_TOKEN_SCOPES = [
  "mcp:access",
  "docs:read",
  "docs:write",
] as const;

export const ALLOWED_TOKEN_SCOPES = [
  ...DEFAULT_TOKEN_SCOPES,
  "tokens:manage",
] as const;

const ALLOWED_TOKEN_SCOPE_SET = new Set<string>(ALLOWED_TOKEN_SCOPES);

export function generateApiToken(): string {
  return `bm_${nanoid(32)}`;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function formatTokenPrefix(token: string): string {
  if (token.length <= 11) return token;
  return `${token.slice(0, 11)}...`;
}

export function parseTokenScopes(value: string | null | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

export function tokenHasScopes(scopeSet: Set<string>, required: string[]): boolean {
  return required.every((scope) => scopeSet.has(scope));
}

export function normalizeTokenScopes(value: string[] | null | undefined): string[] {
  const requested = (value ?? [])
    .map((scope) => scope.trim())
    .filter(Boolean);
  const effective = requested.length > 0 ? requested : [...DEFAULT_TOKEN_SCOPES];
  const deduped = [...new Set(effective)];

  for (const scope of deduped) {
    if (!ALLOWED_TOKEN_SCOPE_SET.has(scope)) {
      throw new Error(`Invalid token scope: ${scope}`);
    }
  }

  return deduped;
}
