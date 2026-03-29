import { db } from "@/lib/db";
import { documentPermissions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type UpsertPermissionInput = {
  id: string;
  documentId: string;
  email: string;
  role: "viewer" | "editor";
  createdAt: number;
};

export async function listPermissionsForDocument(documentId: string) {
  return db
    .select()
    .from(documentPermissions)
    .where(eq(documentPermissions.documentId, documentId));
}

export async function upsertPermission(input: UpsertPermissionInput) {
  await db
    .insert(documentPermissions)
    .values(input)
    .onConflictDoUpdate({
      target: [documentPermissions.documentId, documentPermissions.email],
      set: {
        role: input.role,
      },
    });

  return db
    .select()
    .from(documentPermissions)
    .where(
      and(
        eq(documentPermissions.documentId, input.documentId),
        eq(documentPermissions.email, input.email),
      ),
    )
    .get();
}

export async function deletePermissionById(
  documentId: string,
  permissionId: string,
) {
  const [deleted] = await db
    .delete(documentPermissions)
    .where(
      and(
        eq(documentPermissions.documentId, documentId),
        eq(documentPermissions.id, permissionId),
      ),
    )
    .returning();

  return deleted ?? null;
}
