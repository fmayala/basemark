import { evaluateTokenPolicy } from "@/domain/policies/token-policy";
import {
  findByTokenHash,
  hashToken,
  touchLastUsedAt,
  type TokenRecord,
} from "@/domain/repos/tokens-repo";

type TokensRepo = {
  findByTokenHash: typeof findByTokenHash;
  touchLastUsedAt: typeof touchLastUsedAt;
};

type CreateTokensServiceOptions = {
  repo?: TokensRepo;
  now?: () => number;
};

export type ValidateBearerResult =
  | { status: "invalid" }
  | { status: "scope_denied" }
  | { status: "ok"; token: TokenRecord };

export function createTokensService(options: CreateTokensServiceOptions = {}) {
  const repo = options.repo ?? {
    findByTokenHash,
    touchLastUsedAt,
  };
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  return {
    async validateBearer(token: string, requiredScopes: string[] = []): Promise<ValidateBearerResult> {
      if (!token.startsWith("bm_")) {
        return { status: "invalid" };
      }

      const tokenHash = hashToken(token);
      const record = await repo.findByTokenHash(tokenHash);
      if (!record) {
        return { status: "invalid" };
      }

      const currentTime = now();
      const policyResult = evaluateTokenPolicy({
        token: record,
        requiredScopes,
        now: currentTime,
      });

      if (policyResult === "invalid") return { status: "invalid" };
      if (policyResult === "scope_denied") return { status: "scope_denied" };

      await repo.touchLastUsedAt(record.id, currentTime);
      return { status: "ok", token: record };
    },
  };
}
