import { createHash } from "node:crypto";
import { nanoid } from "nanoid";

export const DEFAULT_TOKEN_SCOPES = [
  "mcp:access",
  "docs:read",
  "docs:write",
] as const;

export function generateApiToken(): string {
  return `bm_${nanoid(32)}`;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function formatTokenPrefix(token: string): string {
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
