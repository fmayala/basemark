import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isOwnerEmail } from "@/lib/authz";

const PUBLIC_ASSET_PATH_RE =
  /\.(?:avif|bmp|css|gif|ico|jpeg|jpg|js|json|map|otf|png|svg|txt|webp|woff|woff2|xml)$/i;

function isPublicAssetPath(pathname: string): boolean {
  return PUBLIC_ASSET_PATH_RE.test(pathname);
}

export async function proxy(req: NextRequest) {
  // Dev bypass: skip all auth in development
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "1") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Public routes — no auth needed
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    isPublicAssetPath(pathname)
  ) {
    return NextResponse.next();
  }

  // Check auth session
  const session = await auth();
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (!isOwnerEmail(session.user?.email)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
