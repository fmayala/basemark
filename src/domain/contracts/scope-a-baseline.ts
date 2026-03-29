export const SCOPE_A_BASELINE_CHECKS = [
  "token-security",
  "mcp-rest-validation-parity",
  "fts-consistency-safety",
  "durable-autosave-replay",
  "mobile-url-source-of-truth",
] as const;

type ScopeABaselineCheck = (typeof SCOPE_A_BASELINE_CHECKS)[number];

const baselineCheckSet = new Set<string>(SCOPE_A_BASELINE_CHECKS);

export function assertScopeABaselineCheck(
  value: string,
): value is ScopeABaselineCheck {
  return baselineCheckSet.has(value);
}
