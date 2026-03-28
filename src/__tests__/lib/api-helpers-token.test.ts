import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb } from "@/test/setup";
import { apiTokens } from "@/lib/db/schema";
import { formatTokenPrefix, hashApiToken } from "@/lib/token-security";

const authMock = vi.hoisted(() => vi.fn());

let testDb = createTestDb();

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb.db;
  },
  dbReady: Promise.resolve(),
}));

const { requireAuth } = await import("@/lib/api-helpers");

function makeRequest(token: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/documents", {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function insertToken(options: {
  token: string;
  scope: string;
  expiresAt?: number | null;
  revokedAt?: number | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  await testDb.db.insert(apiTokens).values({
    id: `tok_${Math.random().toString(36).slice(2)}`,
    tokenHash: hashApiToken(options.token),
    tokenPrefix: formatTokenPrefix(options.token),
    name: "Test token",
    scope: options.scope,
    createdAt: now,
    expiresAt: options.expiresAt ?? null,
    revokedAt: options.revokedAt ?? null,
  });
}

describe("requireAuth token scope", () => {
  beforeEach(() => {
    testDb = createTestDb();
    authMock.mockReset();
    delete process.env.ALLOWED_EMAIL;
  });

  it("returns 403 when bearer token misses required scope", async () => {
    const token = "bm_scope_missing";
    await insertToken({ token, scope: "docs:read" });

    const res = await requireAuth(makeRequest(token), {
      requiredScopes: ["docs:write"],
    });

    expect(res?.status).toBe(403);
  });

  it("returns null when bearer token satisfies required scopes", async () => {
    const token = "bm_scope_ok";
    await insertToken({ token, scope: "docs:read docs:write" });

    const res = await requireAuth(makeRequest(token), {
      requiredScopes: ["docs:write"],
    });

    expect(res).toBeNull();
  });

  it("accepts an empty required scopes list", async () => {
    const token = "bm_scope_empty_required";
    await insertToken({ token, scope: "" });

    const res = await requireAuth(makeRequest(token), {
      requiredScopes: [],
    });

    expect(res).toBeNull();
  });

  it("rejects revoked bearer tokens", async () => {
    const token = "bm_revoked";
    await insertToken({ token, scope: "docs:read", revokedAt: Math.floor(Date.now() / 1000) });
    authMock.mockResolvedValue(null);

    const res = await requireAuth(makeRequest(token), {
      requiredScopes: ["docs:read"],
    });

    expect(res?.status).toBe(401);
  });

  it("rejects expired bearer tokens", async () => {
    const token = "bm_expired";
    await insertToken({ token, scope: "docs:read", expiresAt: Math.floor(Date.now() / 1000) - 60 });
    authMock.mockResolvedValue(null);

    const res = await requireAuth(makeRequest(token), {
      requiredScopes: ["docs:read"],
    });

    expect(res?.status).toBe(401);
  });

  it("requires owner session when allowToken is false", async () => {
    const token = "bm_owner_only";
    await insertToken({ token, scope: "tokens:manage" });

    authMock.mockResolvedValue(null);
    const unauthorized = await requireAuth(makeRequest(token), { allowToken: false });
    expect(unauthorized?.status).toBe(401);

    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockResolvedValue({ user: { email: "owner@example.com" } });
    const allowed = await requireAuth(makeRequest(token), { allowToken: false });
    expect(allowed).toBeNull();
  });
});
