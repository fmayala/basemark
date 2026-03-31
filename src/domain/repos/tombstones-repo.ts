import { nanoid } from "nanoid";

import { db, dbReady } from "@/lib/db";
import { tombstones } from "@/lib/db/schema";

export type TombstoneEntityType = "collection" | "document";

export async function writeTombstone(
  entityType: TombstoneEntityType,
  entityId: string,
  deletedAt = Math.floor(Date.now() / 1000),
): Promise<void> {
  await dbReady;
  await db.insert(tombstones).values({
    id: nanoid(),
    entityType,
    entityId,
    deletedAt,
  });
}
