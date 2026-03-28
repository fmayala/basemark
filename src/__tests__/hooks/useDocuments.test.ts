// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDocuments } from "@/hooks/useDocuments";
import type { Document } from "@/hooks/useDocuments";

const mockDoc: Document = {
  id: "doc-1",
  title: "Test Document",
  content: "Hello world",
  collectionId: null,
  sortOrder: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function mockFetchSuccess(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFailure() {
  return vi.fn().mockRejectedValue(new Error("Network error"));
}

describe("useDocuments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches documents on mount", async () => {
    global.fetch = mockFetchSuccess([mockDoc]);

    const { result } = renderHook(() => useDocuments());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.documents).toHaveLength(1);
    expect(result.current.documents[0].id).toBe("doc-1");
    expect(result.current.documents[0].title).toBe("Test Document");
    expect(global.fetch).toHaveBeenCalledWith("/api/documents");
  });

  it("normalizes documents with missing content to empty string", async () => {
    const docWithoutContent = { ...mockDoc, content: undefined };
    global.fetch = mockFetchSuccess([docWithoutContent]);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.documents[0].content).toBe("");
  });

  it("creates a document", async () => {
    const newDoc: Document = {
      id: "doc-2",
      title: "New Document",
      content: "",
      collectionId: null,
      sortOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // First call: initial fetch; Second call: create POST
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockDoc]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newDoc),
      });

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: Document | null = null;
    await act(async () => {
      created = await result.current.createDocument({ title: "New Document" });
    });

    expect(created).toEqual(newDoc);
    expect(result.current.documents).toHaveLength(2);
    // New doc is prepended
    expect(result.current.documents[0].id).toBe("doc-2");
    expect(result.current.documents[1].id).toBe("doc-1");
  });

  it("updates a document", async () => {
    const updatedDoc: Document = { ...mockDoc, title: "Updated Title" };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockDoc]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedDoc),
      });

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let updated: Document | null = null;
    await act(async () => {
      updated = await result.current.updateDocument("doc-1", {
        title: "Updated Title",
      });
    });

    expect(updated).toEqual(updatedDoc);
    expect(result.current.documents[0].title).toBe("Updated Title");
  });

  it("deletes a document", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockDoc]),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteDocument("doc-1");
    });

    expect(deleted).toBe(true);
    expect(result.current.documents).toHaveLength(0);
  });

  it("handles fetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = mockFetchFailure();

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.documents).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to fetch documents:",
      expect.any(Error),
    );
  });

  it("handles create error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockRejectedValueOnce(new Error("Create failed"));

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: Document | null = null;
    await act(async () => {
      created = await result.current.createDocument({ title: "Fail" });
    });

    expect(created).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to create document:",
      expect.any(Error),
    );
  });

  it("ignores stale document sync events with older updatedAt", async () => {
    const freshDoc: Document = {
      ...mockDoc,
      title: "Fresh Title",
      updatedAt: 200,
    };

    global.fetch = mockFetchSuccess([freshDoc]);

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("outline:document-sync", {
          detail: {
            id: freshDoc.id,
            title: "Stale Title",
            updatedAt: 100,
          },
        }),
      );
    });

    expect(result.current.documents[0].title).toBe("Fresh Title");
    expect(result.current.documents[0].updatedAt).toBe(200);
  });
});
