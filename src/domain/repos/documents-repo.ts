import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";

export type CreateDocumentRecordInput = {
  id: string;
  title: string;
  content: string;
  collectionId?: string | null;
  sortOrder: number;
  now: number;
};

export type UpdateDocumentRecordInput = Partial<
  Pick<
    typeof documents.$inferInsert,
    "title" | "content" | "collectionId" | "isPublic" | "sortOrder" | "updatedAt"
  >
>;

export async function listDocumentRecords(options: { includeContent: boolean }) {
  if (options.includeContent) {
    return db
      .select()
      .from(documents)
      .orderBy(asc(documents.sortOrder), desc(documents.updatedAt));
  }

  return db
    .select({
      id: documents.id,
      title: documents.title,
      collectionId: documents.collectionId,
      isPublic: documents.isPublic,
      sortOrder: documents.sortOrder,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .orderBy(asc(documents.sortOrder), desc(documents.updatedAt));
}

export async function getDocumentRecordById(id: string) {
  return db.select().from(documents).where(eq(documents.id, id)).get();
}

export async function createDocumentRecord(input: CreateDocumentRecordInput) {
  const [doc] = await db
    .insert(documents)
    .values({
      id: input.id,
      title: input.title,
      content: input.content,
      collectionId: input.collectionId ?? null,
      sortOrder: input.sortOrder,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning();

  return doc;
}

export async function updateDocumentRecord(
  id: string,
  updates: UpdateDocumentRecordInput,
) {
  const [doc] = await db
    .update(documents)
    .set(updates)
    .where(eq(documents.id, id))
    .returning();

  return doc ?? null;
}

export async function deleteDocumentRecord(id: string) {
  const [doc] = await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning();

  return doc ?? null;
}
