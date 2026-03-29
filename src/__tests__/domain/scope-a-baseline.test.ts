import { describe, expect, it } from "vitest";
import {
  SCOPE_A_BASELINE_CHECKS,
  assertScopeABaselineCheck,
} from "@/domain/contracts/scope-a-baseline";

describe("scope-a-baseline", () => {
  it("locks all mandatory non-regression checks", () => {
    expect(SCOPE_A_BASELINE_CHECKS).toEqual([
      "token-security",
      "mcp-rest-validation-parity",
      "fts-consistency-safety",
      "durable-autosave-replay",
      "mobile-url-source-of-truth",
    ]);
  });

  it("accepts known checks and rejects unknown checks", () => {
    expect(assertScopeABaselineCheck("token-security")).toBe(true);
    expect(assertScopeABaselineCheck("unknown-check")).toBe(false);
  });
});
