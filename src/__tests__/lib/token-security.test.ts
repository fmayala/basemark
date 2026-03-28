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

  it("returns an empty scope set for nullish/blank values", () => {
    expect(parseTokenScopes(null).size).toBe(0);
    expect(parseTokenScopes(undefined).size).toBe(0);
    expect(parseTokenScopes("").size).toBe(0);
    expect(parseTokenScopes("   \n\t  ").size).toBe(0);
  });

  it("deduplicates parsed scopes", () => {
    const scopes = parseTokenScopes("docs:read docs:read docs:write docs:read");
    expect(scopes.size).toBe(2);
    expect(scopes.has("docs:read")).toBe(true);
    expect(scopes.has("docs:write")).toBe(true);
  });

  it("treats empty required scopes as allowed", () => {
    const scopes = parseTokenScopes("docs:read");
    expect(tokenHasScopes(scopes, [])).toBe(true);
  });

  it("does not truncate very short tokens", () => {
    expect(formatTokenPrefix("bm_short")).toBe("bm_short");
  });
});
