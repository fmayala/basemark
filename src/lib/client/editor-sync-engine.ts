import type { PendingSyncRecord } from "@/lib/client/pending-sync-outbox";

export type PendingSyncField = "title" | "content";

type BuildPendingSyncRecordInput = {
  docId: string;
  field: PendingSyncField;
  value: string;
  current: PendingSyncRecord | null;
  now?: number;
};

export function buildPendingSyncRecord(input: BuildPendingSyncRecordInput): PendingSyncRecord {
  const clientUpdatedAt = input.now ?? Date.now();

  return {
    docId: input.docId,
    pendingTitle: input.field === "title" ? input.value : input.current?.pendingTitle,
    pendingContent: input.field === "content" ? input.value : input.current?.pendingContent,
    clientUpdatedAt,
    retryCount: input.current?.retryCount,
    lastError: undefined,
  };
}

export function clearSyncedField(
  current: PendingSyncRecord,
  field: PendingSyncField,
  syncedValue: string,
  now: number = Date.now(),
): PendingSyncRecord {
  if (field === "title") {
    if (current.pendingTitle !== syncedValue) return current;
    return {
      ...current,
      pendingTitle: undefined,
      clientUpdatedAt: now,
      lastError: undefined,
    };
  }

  if (current.pendingContent !== syncedValue) return current;
  return {
    ...current,
    pendingContent: undefined,
    clientUpdatedAt: now,
    lastError: undefined,
  };
}

export function hasPendingFields(record: PendingSyncRecord | null | undefined): boolean {
  return record?.pendingTitle !== undefined || record?.pendingContent !== undefined;
}
