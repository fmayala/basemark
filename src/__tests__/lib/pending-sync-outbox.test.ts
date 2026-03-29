import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPendingSync,
  readPendingSync,
  writePendingSync,
} from "@/lib/client/pending-sync-outbox";

describe("pending-sync-outbox", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    } satisfies Storage);

    localStorage.clear();
  });

  it("persists and reads latest payload", () => {
    writePendingSync({ docId: "doc-1", pendingContent: "hello", clientUpdatedAt: 100 });
    expect(readPendingSync("doc-1")?.pendingContent).toBe("hello");
  });

  it("clears persisted payload", () => {
    writePendingSync({ docId: "doc-1", pendingTitle: "T", clientUpdatedAt: 100 });
    clearPendingSync("doc-1");
    expect(readPendingSync("doc-1")).toBeNull();
  });

  it("keeps empty-string pending fields", () => {
    writePendingSync({
      docId: "doc-1",
      pendingTitle: "",
      pendingContent: "",
      clientUpdatedAt: 100,
    });

    expect(readPendingSync("doc-1")).toMatchObject({
      pendingTitle: "",
      pendingContent: "",
    });
  });

  it("does not throw when localStorage operations fail", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      clear: () => {
        throw new Error("blocked");
      },
      key: () => null,
      get length() {
        return 0;
      },
    } satisfies Storage);

    expect(() =>
      writePendingSync({ docId: "doc-1", pendingTitle: "x", clientUpdatedAt: Date.now() }),
    ).not.toThrow();
    expect(() => readPendingSync("doc-1")).not.toThrow();
    expect(readPendingSync("doc-1")).toBeNull();
    expect(() => clearPendingSync("doc-1")).not.toThrow();
  });
});
