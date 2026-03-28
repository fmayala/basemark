import { db, dbReady } from "@/lib/db";
import { documents, collections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import DocEditor from "./doc-editor";

interface DocPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocPage({ params }: DocPageProps) {
  await dbReady;
  const { id } = await params;

  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) notFound();

  let collectionName: string | null = null;
  if (doc.collectionId) {
    const [col] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, doc.collectionId));
    collectionName = col?.name ?? null;
  }

  return (
    <DocEditor
      initialDoc={doc}
      initialCollectionName={collectionName}
    />
  );
}
