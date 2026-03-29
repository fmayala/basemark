import { describe, expect, it } from "vitest";

import {
  buildPendingSyncRecord,
  clearSyncedField,
  hasPendingFields,
  type PendingSyncRecord,
} from "@/lib/client/editor-sync-engine";

describe("pending sync outbox", () => {
  it("persists pending fields into outbox and reads them back", () => {
    const pending: PendingSyncRecord = {
      title: "Draft title",
      content: "Draft content",
    };

    const outbox = buildPendingSyncRecord(pending);

    expect(outbox).toEqual({ title: "Draft title", content: "Draft content" });
    expect(hasPendingFields(outbox)).toBe(true);
  });

  it("clear behavior removes field from outbox", () => {
    const pending: PendingSyncRecord = {
      title: "Draft title",
      content: "Draft content",
    };

    const cleared = clearSyncedField(pending, "title");
    const outbox = buildPendingSyncRecord(cleared);

    expect(cleared).toEqual({ title: null, content: "Draft content" });
    expect(outbox).toEqual({ content: "Draft content" });
  });

  it("one-field clear preserves other field semantics for replay/flush", () => {
    const pending: PendingSyncRecord = {
      title: "",
      content: "Body",
    };

    const afterContentSync = clearSyncedField(pending, "content");
    const outbox = buildPendingSyncRecord(afterContentSync);

    expect(afterContentSync).toEqual({ title: "", content: null });
    expect(outbox).toEqual({ title: "" });
    expect(hasPendingFields(outbox)).toBe(true);
  });

  it("replay-flush sequence reaches empty outbox after both fields clear", () => {
    const pending: PendingSyncRecord = {
      title: "T",
      content: "C",
    };

    const afterTitleSync = clearSyncedField(pending, "title");
    expect(buildPendingSyncRecord(afterTitleSync)).toEqual({ content: "C" });

    const afterContentSync = clearSyncedField(afterTitleSync, "content");
    const outbox = buildPendingSyncRecord(afterContentSync);

    expect(outbox).toEqual({});
    expect(hasPendingFields(outbox)).toBe(false);
  });
});
