import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { db, dbReady } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { hashToken } from "@/domain/repos/tokens-repo";
import { isOwnerEmail } from "@/lib/authz";
import { buildMobileAuthRedirect, parseMobileAuthCallback } from "@/lib/mobile-auth";

function redirectWithError(callback: URL, code: string) {
  return NextResponse.redirect(buildMobileAuthRedirect(callback, { error: code }));
}

export async function GET(req: NextRequest) {
  await dbReady;

  const callback = parseMobileAuthCallback(req.nextUrl.searchParams.get("callback"));
  if (!callback) {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return redirectWithError(callback, "unauthorized");
  }

  if (!isOwnerEmail(session.user.email)) {
    return redirectWithError(callback, "forbidden");
  }

  try {
    const id = nanoid();
    const token = "bm_" + nanoid(32);
    const createdAt = Math.floor(Date.now() / 1000);

    await db.insert(apiTokens).values({
      id,
      tokenHash: hashToken(token),
      name: "Basemark iOS",
      scope: "documents:read documents:write",
      createdAt,
    });

    return NextResponse.redirect(buildMobileAuthRedirect(callback, { token }));
  } catch {
    return redirectWithError(callback, "server_error");
  }
}
