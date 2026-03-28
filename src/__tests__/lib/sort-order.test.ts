import { describe, it, expect } from "vitest";
import { computeSortUpdates } from "@/lib/sort-order";

const item = (id: string, sortOrder: number) => ({ id, sortOrder });

describe("computeSortUpdates", () => {
  it("bulk-reindexes when all destination items share the same sortOrder (default zero-state)", () => {
    // destination=[a(0), c(0)], moving b(0) to index 1 → result=[a, b, c], all same → bulk
    const result = computeSortUpdates([item("a", 0), item("c", 0)], item("b", 0), 1);
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.id === "a")?.sortOrder).toBe(0);
    expect(result.find((r) => r.id === "b")?.sortOrder).toBe(1000);
    expect(result.find((r) => r.id === "c")?.sortOrder).toBe(2000);
  });

  it("returns only the moved item when neighbors have distinct sortOrders", () => {
    // destination=[a(0), c(2000)], insert b between them at index 1
    const result = computeSortUpdates([item("a", 0), item("c", 2000)], item("b", 999), 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
    expect(result[0].sortOrder).toBe(1000); // midpoint of 0 and 2000
  });

  it("inserts at the start (no previous neighbor) uses next - 1000", () => {
    // destination=[b(1000), c(2000)], insert a before b at index 0
    const result = computeSortUpdates([item("b", 1000), item("c", 2000)], item("a", 500), 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
    expect(result[0].sortOrder).toBe(0); // 1000 - 1000
  });

  it("inserts at the end (no next neighbor) uses prev + 1000", () => {
    // destination=[a(0), b(1000)], insert c after b at index 2
    const result = computeSortUpdates([item("a", 0), item("b", 1000)], item("c", 500), 2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c");
    expect(result[0].sortOrder).toBe(2000); // 1000 + 1000
  });

  it("handles empty destination list (cross-collection drop to empty collection)", () => {
    const result = computeSortUpdates([], item("a", 0), 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
    expect(result[0].sortOrder).toBe(0);
  });

  it("inserts after a single existing item with a distinct sortOrder uses fractional, not bulk", () => {
    // dest=[b(1000)], insert c after it at index 1 — should use prev+1000, not bulk reindex
    const result = computeSortUpdates([item("b", 1000)], item("c", 0), 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c");
    expect(result[0].sortOrder).toBe(2000); // 1000 + 1000
  });

  it("bulk-reindexes when single destination item also shares sortOrder with moved item", () => {
    // dest=[a(0)], moving b(0) — both zero → bulk reindex
    const result = computeSortUpdates([item("a", 0)], item("b", 0), 0);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "b")?.sortOrder).toBe(0);
    expect(result.find((r) => r.id === "a")?.sortOrder).toBe(1000);
  });
});
