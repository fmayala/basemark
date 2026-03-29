export type PendingSyncField = "title" | "content";

export type PendingSyncRecord = {
  title: string | null;
  content: string | null;
};

export type PendingSyncOutbox = Partial<Record<PendingSyncField, string>>;

export function buildPendingSyncRecord(pending: PendingSyncRecord): PendingSyncOutbox {
  const outbox: PendingSyncOutbox = {};

  if (pending.title !== null) {
    outbox.title = pending.title;
  }
  if (pending.content !== null) {
    outbox.content = pending.content;
  }

  return outbox;
}

export function clearSyncedField(
  pending: PendingSyncRecord,
  field: PendingSyncField,
): PendingSyncRecord {
  if (field === "title") {
    return { title: null, content: pending.content };
  }

  return { title: pending.title, content: null };
}

export function hasPendingFields(outbox: PendingSyncOutbox | PendingSyncRecord): boolean {
  return (outbox.title !== undefined && outbox.title !== null) || (outbox.content !== undefined && outbox.content !== null);
}
