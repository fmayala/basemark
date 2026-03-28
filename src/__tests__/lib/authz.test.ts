import { beforeEach, describe, expect, it } from "vitest";
import { isOwnerEmail } from "@/lib/authz";

describe("isOwnerEmail", () => {
  beforeEach(() => {
    delete process.env.ALLOWED_EMAIL;
  });

  it("fails closed when ALLOWED_EMAIL is not configured", () => {
    expect(isOwnerEmail("owner@example.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });

  it("matches configured owner email case-insensitively", () => {
    process.env.ALLOWED_EMAIL = "Owner@Example.com";
    expect(isOwnerEmail("owner@example.com")).toBe(true);
    expect(isOwnerEmail("viewer@example.com")).toBe(false);
  });
});
