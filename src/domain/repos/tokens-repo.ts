import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";

export type TokenRecord = {
  id: string;
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  expiresAt: number | null;
  scope: string;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findByTokenHash(tokenHash: string): Promise<TokenRecord | null> {
  await dbReady;
  const row = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash)).get();
  if (!row) return null;

  return {
    id: row.id,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null,
    revokedAt: row.revokedAt ?? null,
    expiresAt: row.expiresAt ?? null,
    scope: row.scope,
  };
}

export async function touchLastUsedAt(id: string, at: number): Promise<void> {
  await dbReady;
  await db.update(apiTokens).set({ lastUsedAt: at }).where(eq(apiTokens.id, id)).run();
}
