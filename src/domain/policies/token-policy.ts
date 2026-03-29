export type TokenPolicySubject = {
  revokedAt?: number | null;
  expiresAt?: number | null;
  scope?: string | null;
};

export type TokenPolicyResult = "ok" | "invalid" | "scope_denied";

type EvaluateTokenPolicyInput = {
  token: TokenPolicySubject;
  requiredScopes: string[];
  now: number;
};

function normalizeScopes(scope: string | null | undefined): Set<string> {
  if (!scope) return new Set();

  return new Set(
    scope
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function evaluateTokenPolicy(input: EvaluateTokenPolicyInput): TokenPolicyResult {
  if (input.token.revokedAt != null) return "invalid";
  if (input.token.expiresAt != null && input.token.expiresAt <= input.now) return "invalid";

  if (input.requiredScopes.length === 0) return "ok";

  const tokenScopes = normalizeScopes(input.token.scope);
  if (tokenScopes.has("*")) return "ok";

  const hasAllScopes = input.requiredScopes.every((scope) => tokenScopes.has(scope));
  return hasAllScopes ? "ok" : "scope_denied";
}
