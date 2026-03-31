import { NextRequest, NextResponse } from "next/server";
import { asc, gte, inArray } from "drizzle-orm";

import { authenticateBearer } from "@/lib/api-helpers";
import { db, dbReady } from "@/lib/db";
import { collections, documents, tombstones } from "@/lib/db/schema";

type ChangeKind = "collection" | "deletion" | "document";

type ChangeMeta = {
  kind: ChangeKind;
  id: string;
  changedAt: number;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function parseOptionalInt(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function compareChanges(left: ChangeMeta, right: ChangeMeta): number {
  if (left.changedAt !== right.changedAt) return left.changedAt - right.changedAt;
  if (left.kind !== right.kind) return left.kind.localeCompare(right.kind);
  return left.id.localeCompare(right.id);
}

async function listDocumentsSince(cursor: number | null, limit: number) {
  if (cursor == null) {
    return db
      .select()
      .from(documents)
      .orderBy(asc(documents.updatedAt), asc(documents.id))
      .limit(limit);
  }

  return db
    .select()
    .from(documents)
    .where(gte(documents.updatedAt, cursor))
    .orderBy(asc(documents.updatedAt), asc(documents.id))
    .limit(limit);
}

async function listCollectionsSince(cursor: number | null, limit: number) {
  if (cursor == null) {
    return db
      .select()
      .from(collections)
      .orderBy(asc(collections.updatedAt), asc(collections.id))
      .limit(limit);
  }

  return db
    .select()
    .from(collections)
    .where(gte(collections.updatedAt, cursor))
    .orderBy(asc(collections.updatedAt), asc(collections.id))
    .limit(limit);
}

async function listDeletionsSince(cursor: number | null, limit: number) {
  if (cursor == null) {
    return db
      .select()
      .from(tombstones)
      .orderBy(asc(tombstones.deletedAt), asc(tombstones.id))
      .limit(limit);
  }

  return db
    .select()
    .from(tombstones)
    .where(gte(tombstones.deletedAt, cursor))
    .orderBy(asc(tombstones.deletedAt), asc(tombstones.id))
    .limit(limit);
}

export async function GET(req: NextRequest) {
  await dbReady;

  const auth = await authenticateBearer(req, ["documents:read"]);
  if (auth.status === "invalid") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.status === "scope_denied") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cursorParam = parseOptionalInt(req.nextUrl.searchParams.get("cursor"));
  if (req.nextUrl.searchParams.has("cursor") && cursorParam == null) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const limitParam = parseOptionalInt(req.nextUrl.searchParams.get("limit"));
  if (req.nextUrl.searchParams.has("limit") && limitParam == null) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const limit = Math.min(Math.max(limitParam ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const fetchLimit = limit + 1;

  const [documentRows, collectionRows, deletionRows] = await Promise.all([
    listDocumentsSince(cursorParam, fetchLimit),
    listCollectionsSince(cursorParam, fetchLimit),
    listDeletionsSince(cursorParam, fetchLimit),
  ]);

  const changeSet: ChangeMeta[] = [
    ...documentRows.map((row) => ({
      kind: "document" as const,
      id: row.id,
      changedAt: row.updatedAt,
    })),
    ...collectionRows.map((row) => ({
      kind: "collection" as const,
      id: row.id,
      changedAt: row.updatedAt,
    })),
    ...deletionRows.map((row) => ({
      kind: "deletion" as const,
      id: row.id,
      changedAt: row.deletedAt,
    })),
  ].sort(compareChanges);

  const page = changeSet.slice(0, limit);
  const hasMore = changeSet.length > limit;
  const nextCursor = page.length > 0 ? page[page.length - 1]!.changedAt : (cursorParam ?? 0);

  const documentIds = page.filter((item) => item.kind === "document").map((item) => item.id);
  const collectionIds = page.filter((item) => item.kind === "collection").map((item) => item.id);
  const deletionIds = page.filter((item) => item.kind === "deletion").map((item) => item.id);

  const [pageDocuments, pageCollections, pageDeletions] = await Promise.all([
    documentIds.length > 0
      ? db.select().from(documents).where(inArray(documents.id, documentIds))
      : Promise.resolve([]),
    collectionIds.length > 0
      ? db.select().from(collections).where(inArray(collections.id, collectionIds))
      : Promise.resolve([]),
    deletionIds.length > 0
      ? db.select().from(tombstones).where(inArray(tombstones.id, deletionIds))
      : Promise.resolve([]),
  ]);

  const documentMap = new Map(pageDocuments.map((row) => [row.id, row]));
  const collectionMap = new Map(pageCollections.map((row) => [row.id, row]));
  const deletionMap = new Map(pageDeletions.map((row) => [row.id, row]));

  return NextResponse.json({
    documents: page
      .filter((item) => item.kind === "document")
      .map((item) => documentMap.get(item.id))
      .filter(Boolean),
    collections: page
      .filter((item) => item.kind === "collection")
      .map((item) => collectionMap.get(item.id))
      .filter(Boolean),
    deletions: page
      .filter((item) => item.kind === "deletion")
      .map((item) => deletionMap.get(item.id))
      .filter(Boolean)
      .map((row) => ({
        entityType: row!.entityType,
        entityId: row!.entityId,
        deletedAt: row!.deletedAt,
      })),
    cursor: nextCursor,
    hasMore,
  });
}
