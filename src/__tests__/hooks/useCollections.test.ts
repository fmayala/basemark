// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCollections } from "@/hooks/useCollections";
import type { Collection } from "@/hooks/useCollections";

const mockCollection: Collection = {
  id: "col-1",
  name: "Test Collection",
  icon: null,
  color: null,
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

describe("useCollections", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches collections on mount", async () => {
    global.fetch = mockFetchSuccess([mockCollection]);

    const { result } = renderHook(() => useCollections());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toHaveLength(1);
    expect(result.current.collections[0].id).toBe("col-1");
    expect(result.current.collections[0].name).toBe("Test Collection");
    expect(global.fetch).toHaveBeenCalledWith("/api/collections");
  });

  it("creates a collection", async () => {
    const newCol: Collection = {
      id: "col-2",
      name: "New Collection",
      icon: "star",
      color: "#ff0000",
      sortOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockCollection]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newCol),
      });

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: Collection | null = null;
    await act(async () => {
      created = await result.current.createCollection({
        name: "New Collection",
        icon: "star",
        color: "#ff0000",
      });
    });

    expect(created).toEqual(newCol);
    expect(result.current.collections).toHaveLength(2);
    // New collection is appended
    expect(result.current.collections[1].id).toBe("col-2");
  });

  it("handles fetch error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = mockFetchFailure();

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to fetch collections:",
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

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: Collection | null = null;
    await act(async () => {
      created = await result.current.createCollection({ name: "Fail" });
    });

    expect(created).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to create collection:",
      expect.any(Error),
    );
  });

  it("can refresh collections", async () => {
    const secondList: Collection[] = [
      mockCollection,
      { ...mockCollection, id: "col-3", name: "Another" },
    ];

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockCollection]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondList),
      });

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toHaveLength(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.collections).toHaveLength(2);
  });
});
