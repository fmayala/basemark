import { describe, expect, it, vi } from "vitest";

import { createTokensService } from "@/domain/services/tokens-service";
import { hashToken } from "@/domain/repos/tokens-repo";

describe("tokens-service", () => {
  it("returns invalid when token record is missing", async () => {
    const repo = {
      findByTokenHash: vi.fn().mockResolvedValue(null),
      touchLastUsedAt: vi.fn(),
    };

    const service = createTokensService({ repo, now: () => 1_700_000_000 });
    const result = await service.validateBearer("bm_missing", ["documents:read"]);

    expect(result.status).toBe("invalid");
    expect(repo.findByTokenHash).toHaveBeenCalledWith(hashToken("bm_missing"));
    expect(repo.touchLastUsedAt).not.toHaveBeenCalled();
  });

  it("returns invalid when token is revoked", async () => {
    const repo = {
      findByTokenHash: vi.fn().mockResolvedValue({
        id: "tok_1",
        revokedAt: 1_699_999_999,
        expiresAt: null,
        scope: "documents:read",
      }),
      touchLastUsedAt: vi.fn(),
    };

    const service = createTokensService({ repo, now: () => 1_700_000_000 });
    const result = await service.validateBearer("bm_revoked", ["documents:read"]);

    expect(result.status).toBe("invalid");
    expect(repo.touchLastUsedAt).not.toHaveBeenCalled();
  });

  it("returns invalid when token is expired", async () => {
    const repo = {
      findByTokenHash: vi.fn().mockResolvedValue({
        id: "tok_1",
        revokedAt: null,
        expiresAt: 1_699_999_999,
        scope: "documents:read",
      }),
      touchLastUsedAt: vi.fn(),
    };

    const service = createTokensService({ repo, now: () => 1_700_000_000 });
    const result = await service.validateBearer("bm_expired", ["documents:read"]);

    expect(result.status).toBe("invalid");
    expect(repo.touchLastUsedAt).not.toHaveBeenCalled();
  });

  it("returns scope_denied when scopes are missing", async () => {
    const repo = {
      findByTokenHash: vi.fn().mockResolvedValue({
        id: "tok_1",
        revokedAt: null,
        expiresAt: null,
        scope: "documents:read",
      }),
      touchLastUsedAt: vi.fn(),
    };

    const service = createTokensService({ repo, now: () => 1_700_000_000 });
    const result = await service.validateBearer("bm_scoped", ["documents:write"]);

    expect(result.status).toBe("scope_denied");
    expect(repo.touchLastUsedAt).not.toHaveBeenCalled();
  });

  it("returns ok and updates lastUsedAt when token is valid", async () => {
    const repo = {
      findByTokenHash: vi.fn().mockResolvedValue({
        id: "tok_1",
        revokedAt: null,
        expiresAt: 1_700_000_999,
        scope: "documents:read documents:write",
      }),
      touchLastUsedAt: vi.fn().mockResolvedValue(undefined),
    };

    const service = createTokensService({ repo, now: () => 1_700_000_000 });
    const result = await service.validateBearer("bm_valid", ["documents:read"]);

    expect(result.status).toBe("ok");
    expect(result.token?.id).toBe("tok_1");
    expect(repo.touchLastUsedAt).toHaveBeenCalledWith("tok_1", 1_700_000_000);
  });
});
