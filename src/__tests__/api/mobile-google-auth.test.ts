import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const signInMock = vi.hoisted(() => vi.fn());
const insertValuesMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn(() => ({ values: insertValuesMock })));

vi.mock("@/auth", () => ({
  auth: authMock,
  signIn: signInMock,
}));

vi.mock("@/lib/db", () => ({
  dbReady: Promise.resolve(),
  db: {
    insert: insertMock,
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mobile-token"),
}));

const { GET: startGoogleAuth } = await import("@/app/api/auth/mobile/google/route");
const { GET: finishGoogleAuth } = await import("@/app/api/auth/mobile/google/callback/route");

describe("mobile google auth routes", () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    authMock.mockReset();
    signInMock.mockReset();
    insertMock.mockClear();
    insertValuesMock.mockReset();
  });

  it("rejects invalid mobile callback URLs before starting google auth", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/mobile/google?callback=https://evil.example/cb");
    const res = await startGoogleAuth(req);

    expect(res.status).toBe(400);
  });

  it("redirects through nextauth google sign-in for valid callbacks", async () => {
    signInMock.mockResolvedValue("http://localhost:3000/api/auth/signin/google");

    const req = new NextRequest("http://localhost:3000/api/auth/mobile/google?callback=basemark://auth");
    const res = await startGoogleAuth(req);

    expect(signInMock).toHaveBeenCalledWith("google", {
      redirect: false,
      redirectTo: "/api/auth/mobile/google/callback?callback=basemark%3A%2F%2Fauth",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/api/auth/signin/google");
  });

  it("redirects back to the app with an error when the session is missing", async () => {
    authMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/auth/mobile/google/callback?callback=basemark://auth");
    const res = await finishGoogleAuth(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("basemark://auth?error=unauthorized");
  });

  it("creates a write-capable token for the owner and redirects back to the app", async () => {
    authMock.mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    insertValuesMock.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/auth/mobile/google/callback?callback=basemark://auth");
    const res = await finishGoogleAuth(req);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mobile-token",
        name: "Basemark iOS",
        scope: "documents:read documents:write",
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("basemark://auth?token=bm_mobile-token");
  });
});
