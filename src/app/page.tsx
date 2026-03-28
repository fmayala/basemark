import { db, dbReady } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { HomePage } from "@/components/home/HomePage";

export const dynamic = "force-dynamic";

export default async function Home() {
  await dbReady;
  const recentDocs = await db
    .select()
    .from(documents)
    .orderBy(desc(documents.updatedAt))
    .limit(8);

  return <HomePage initialDocuments={recentDocs} />;
}
