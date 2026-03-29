import { describe, expect, it } from "vitest";

import {
  buildPendingSyncRecord,
  clearSyncedField,
  hasPendingFields,
  type PendingSyncRecord,
} from "@/lib/client/editor-sync-engine";

describe("editor sync engine", () => {
  it("buildPendingSyncRecord keeps empty string pending values", () => {
    const pending: PendingSyncRecord = { title: "", content: null };

    expect(buildPendingSyncRecord(pending)).toEqual({ title: "" });
  });

  it("clearSyncedField clears only the synced field", () => {
    const pending: PendingSyncRecord = { title: "Draft", content: "Body" };

    expect(clearSyncedField(pending, "title")).toEqual({ title: null, content: "Body" });
    expect(clearSyncedField(pending, "content")).toEqual({ title: "Draft", content: null });
  });

  it("hasPendingFields treats empty strings as pending", () => {
    expect(hasPendingFields({ title: "", content: null })).toBe(true);
    expect(hasPendingFields({ title: null, content: "" })).toBe(true);
  });

  it("hasPendingFields is false when no fields are pending", () => {
    expect(hasPendingFields({ title: null, content: null })).toBe(false);
  });
});
