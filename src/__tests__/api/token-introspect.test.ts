import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { createTestDb } from "@/test/setup";
import { hashToken } from "@/domain/repos/tokens-repo";

let testDb = createTestDb();

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  get sqlite() {
    return testDb.sqlite;
  },
  dbReady: Promise.resolve(),
}));

const { GET } = await import("@/app/api/tokens/introspect/route");

describe("GET /api/tokens/introspect", () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  it("returns valid false for missing or invalid bearer tokens", async () => {
    const missingRes = await GET(new NextRequest("http://localhost:3000/api/tokens/introspect"));
    const invalidRes = await GET(
      new NextRequest("http://localhost:3000/api/tokens/introspect", {
        headers: { Authorization: "Bearer bm_missing" },
      }),
    );

    expect(missingRes.status).toBe(401);
    await expect(missingRes.json()).resolves.toEqual({ valid: false });
    expect(invalidRes.status).toBe(401);
    await expect(invalidRes.json()).resolves.toEqual({ valid: false });
  });

  it("returns token metadata for a valid bearer token", async () => {
    testDb.sqlite
      .prepare(
        `
          insert into api_tokens (
            id, token_hash, name, scope, expires_at, created_at
          ) values (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "tok_1",
        hashToken("bm_valid_token"),
        "Mobile",
        "documents:read documents:write",
        1_900_000_000,
        1_700_000_000,
      );

    const res = await GET(
      new NextRequest("http://localhost:3000/api/tokens/introspect", {
        headers: { Authorization: "Bearer bm_valid_token" },
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      valid: true,
      tokenId: "tok_1",
      scopes: ["documents:read", "documents:write"],
      expiresAt: 1_900_000_000,
      createdAt: 1_700_000_000,
    });
  });
});
