// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { Collection } from "@/hooks/useCollections";
import type { Document } from "@/hooks/useDocuments";
import { deriveCollectionRows } from "@/components/home/HomePage";

const col = (id: string, name: string): Collection => ({
  id,
  name,
  icon: null,
  color: null,
  sortOrder: 0,
  createdAt: 1000,
});

const doc = (id: string, collectionId: string | null, updatedAt: number, title = "Doc"): Document => ({
  id,
  title,
  content: "",
  collectionId,
  sortOrder: 0,
  createdAt: 1000,
  updatedAt,
});

describe("deriveCollectionRows", () => {
  it("returns empty array when no documents", () => {
    expect(deriveCollectionRows([], [col("c1", "Infra")])).toEqual([]);
  });

  it("skips collections with no documents", () => {
    const rows = deriveCollectionRows(
      [doc("d1", "c1", 1000)],
      [col("c1", "Infra"), col("c2", "Empty")],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Infra");
  });

  it("sorts collection rows by most-recently-active first", () => {
    const rows = deriveCollectionRows(
      [doc("d1", "c1", 1000), doc("d2", "c2", 2000)],
      [col("c1", "Infra"), col("c2", "Meetings")],
    );
    expect(rows[0].name).toBe("Meetings");
    expect(rows[1].name).toBe("Infra");
  });

  it("includes the total doc count per collection", () => {
    const rows = deriveCollectionRows(
      [doc("d1", "c1", 1000), doc("d2", "c1", 900)],
      [col("c1", "Infra")],
    );
    expect(rows[0].count).toBe(2);
  });

  it("latestDoc is the most recently edited doc in the collection", () => {
    const rows = deriveCollectionRows(
      [doc("d1", "c1", 1000, "Older"), doc("d2", "c1", 2000, "Newer")],
      [col("c1", "Infra")],
    );
    expect(rows[0].latestDoc?.title).toBe("Newer");
  });

  it("includes uncategorized docs as a row at the correct sorted position", () => {
    const rows = deriveCollectionRows(
      [doc("d1", "c1", 1000), doc("d2", null, 3000)],
      [col("c1", "Infra")],
    );
    expect(rows[0].name).toBe("Uncategorized");
    expect(rows[1].name).toBe("Infra");
  });

  it("omits uncategorized row when no uncategorized docs exist", () => {
    const rows = deriveCollectionRows(
      [doc("d1", "c1", 1000)],
      [col("c1", "Infra")],
    );
    expect(rows.every((r) => r.name !== "Uncategorized")).toBe(true);
  });
});
