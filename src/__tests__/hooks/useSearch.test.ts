// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSearch } from "@/hooks/useSearch";

const mockResults = [
  { id: "doc-1", title: "Test Document", snippet: "...test content..." },
  { id: "doc-2", title: "Another Doc", snippet: "...another..." },
];

describe("useSearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns empty results for short query (less than 2 chars)", () => {
    global.fetch = vi.fn();

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search("a");
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("debounces search requests with 200ms delay", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults),
    });

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search("test query");
    });

    // Should not have called fetch yet (debounce pending)
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);

    // Advance past the 200ms debounce
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search?q=test%20query",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("clears results when query becomes too short", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults),
    });

    const { result } = renderHook(() => useSearch());

    // Trigger a valid search
    act(() => {
      result.current.search("test");
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Wait for results
    vi.useRealTimers();
    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });

    // Now clear by searching with a short query
    act(() => {
      result.current.search("t");
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("cancels previous search when a new one is issued", async () => {
    vi.useFakeTimers();

    const firstResults = [{ id: "1", title: "First", snippet: "first" }];
    const secondResults = [{ id: "2", title: "Second", snippet: "second" }];

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(firstResults),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondResults),
      });

    const { result } = renderHook(() => useSearch());

    // First search
    act(() => {
      result.current.search("first");
    });

    // Advance partially (100ms) then issue second search
    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current.search("second");
    });

    // The first timer was cleared, fetch should not have been called yet
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance past debounce for second search
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Only one fetch should have been made (the second search)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search?q=second",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("handles fetch error gracefully", async () => {
    vi.useFakeTimers();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search("test query");
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    vi.useRealTimers();
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to fetch search results:",
      expect.any(Error),
    );
  });

  it("clears stale results when latest request is non-ok", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "bad request" }),
      });

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.search("first");
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });

    act(() => {
      result.current.search("second");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.results).toEqual([]);
  });
});
