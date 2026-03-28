export type PendingSyncRecord = {
  docId: string;
  pendingTitle?: string;
  pendingContent?: string;
  clientUpdatedAt: number;
  retryCount?: number;
  lastError?: string;
};

const KEY_PREFIX = "basemark:pending-sync:";

function getStorage(): Storage | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function writePendingSync(record: PendingSyncRecord): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(`${KEY_PREFIX}${record.docId}`, JSON.stringify(record));
  } catch {
    // Best-effort only; keep unsent changes in memory.
  }
}

export function readPendingSync(docId: string): PendingSyncRecord | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(`${KEY_PREFIX}${docId}`);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingSyncRecord;
  } catch {
    return null;
  }
}

export function clearPendingSync(docId: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(`${KEY_PREFIX}${docId}`);
  } catch {
    // Ignore storage cleanup failures.
  }
}
