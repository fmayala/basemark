import { describe, expect, it } from "vitest";
import {
  formatTokenPrefix,
  generateApiToken,
  hashApiToken,
  parseTokenScopes,
  tokenHasScopes,
} from "@/lib/token-security";

describe("token-security", () => {
  it("generates bm_ prefixed tokens", () => {
    const token = generateApiToken();
    expect(token.startsWith("bm_")).toBe(true);
    expect(token.length).toBeGreaterThan(20);
  });

  it("hashes deterministically", () => {
    const token = "bm_example_token_value";
    expect(hashApiToken(token)).toBe(hashApiToken(token));
  });

  it("formats token prefix for UI", () => {
    const token = "bm_1234567890ABCDEFGHIJ";
    expect(formatTokenPrefix(token)).toBe("bm_12345678...");
  });

  it("parses scopes and enforces requirements", () => {
    const scopes = parseTokenScopes("mcp:access docs:read docs:write");
    expect(tokenHasScopes(scopes, ["mcp:access"])).toBe(true);
    expect(tokenHasScopes(scopes, ["tokens:manage"])).toBe(false);
  });
});
