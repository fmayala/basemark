import { NextRequest, NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { auth } from "@/auth";
import { createSharingService } from "@/domain/services/sharing-service";

type Params = { params: Promise<{ token: string }> };

const sharingService = createSharingService();

export async function GET(_req: NextRequest, { params }: Params) {
  await dbReady;
  const { token } = await params;

  const resolved = await sharingService.resolveSharedDocument({ token });
  if (resolved.status === "ready") {
    return NextResponse.json(resolved.document);
  }
  if (resolved.status === "expired") {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  if (resolved.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const resolvedWithViewer = await sharingService.resolveSharedDocument({
    token,
    viewerEmail: session.user.email,
  });
  if (resolvedWithViewer.status === "ready") {
    return NextResponse.json(resolvedWithViewer.document);
  }
  if (resolvedWithViewer.status === "expired") {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  if (resolvedWithViewer.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (resolvedWithViewer.status === "auth_required") {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}
