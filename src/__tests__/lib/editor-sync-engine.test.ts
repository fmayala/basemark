import { describe, expect, it } from "vitest";

import {
  buildPendingSyncRecord,
  clearSyncedField,
  hasPendingFields,
} from "@/lib/client/editor-sync-engine";
import type { PendingSyncRecord } from "@/lib/client/pending-sync-outbox";

describe("editor sync engine", () => {
  it("buildPendingSyncRecord keeps empty string values", () => {
    const current: PendingSyncRecord = {
      docId: "doc-1",
      pendingContent: "Body",
      clientUpdatedAt: 100,
    };

    expect(
      buildPendingSyncRecord({
        docId: "doc-1",
        field: "title",
        value: "",
        current,
        now: 200,
      }),
    ).toEqual({
      docId: "doc-1",
      pendingTitle: "",
      pendingContent: "Body",
      clientUpdatedAt: 200,
      retryCount: undefined,
      lastError: undefined,
    });
  });

  it("clearSyncedField clears only matching synced field", () => {
    const pending: PendingSyncRecord = {
      docId: "doc-1",
      pendingTitle: "Draft",
      pendingContent: "Body",
      clientUpdatedAt: 100,
    };

    expect(clearSyncedField(pending, "title", "Draft", 200)).toEqual({
      docId: "doc-1",
      pendingTitle: undefined,
      pendingContent: "Body",
      clientUpdatedAt: 200,
      lastError: undefined,
    });

    expect(clearSyncedField(pending, "title", "Newer Draft", 200)).toEqual(pending);
    expect(clearSyncedField(pending, "content", "Body", 200)).toEqual({
      docId: "doc-1",
      pendingTitle: "Draft",
      pendingContent: undefined,
      clientUpdatedAt: 200,
      lastError: undefined,
    });
  });

  it("hasPendingFields treats empty strings as pending", () => {
    expect(
      hasPendingFields({
        docId: "doc-1",
        pendingTitle: "",
        clientUpdatedAt: 1,
      }),
    ).toBe(true);
    expect(
      hasPendingFields({
        docId: "doc-1",
        pendingContent: "",
        clientUpdatedAt: 1,
      }),
    ).toBe(true);
  });

  it("hasPendingFields is false when no fields are pending", () => {
    expect(hasPendingFields({ docId: "doc-1", clientUpdatedAt: 1 })).toBe(false);
    expect(hasPendingFields(null)).toBe(false);
  });
});
