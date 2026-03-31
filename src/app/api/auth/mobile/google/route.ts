import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/auth";
import { parseMobileAuthCallback } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const callback = parseMobileAuthCallback(req.nextUrl.searchParams.get("callback"));
  if (!callback) {
    return NextResponse.json({ error: "Invalid callback URL" }, { status: 400 });
  }

  const redirectTo = `/api/auth/mobile/google/callback?callback=${encodeURIComponent(callback.toString())}`;
  const providerRedirect = await signIn("google", {
    redirect: false,
    redirectTo,
  });

  return NextResponse.redirect(new URL(providerRedirect, req.url));
}
