import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

const { proxy } = await import("@/proxy");

describe("proxy", () => {
  beforeEach(() => {
    authMock.mockReset();
    delete process.env.ALLOWED_EMAIL;
  });

  it("lets API requests through without redirecting", async () => {
    const req = new NextRequest("http://localhost:3000/api/documents", {
      headers: { authorization: "Bearer test-token" },
    });

    const res = await proxy(req);

    expect(res.headers.get("location")).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });

  it("redirects protected page requests without a session", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/doc/abc");

    const res = await proxy(req);

    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("does not treat dotted app routes as public", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/doc/abc.def");

    const res = await proxy(req);

    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect(authMock).toHaveBeenCalledTimes(1);
  });

  it("redirects signed-in non-owner users from protected pages", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockResolvedValue({
      user: { email: "viewer@example.com" },
    });

    const req = new NextRequest("http://localhost:3000/doc/abc");

    const res = await proxy(req);

    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?error=AccessDenied",
    );
  });
});
