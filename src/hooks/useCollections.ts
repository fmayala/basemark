"use client";

import { useState, useEffect, useCallback } from "react";

export interface Collection {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (err) {
      console.error("Failed to fetch collections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCollection = useCallback(
    async (opts: {
      name: string;
      icon?: string | null;
      color?: string | null;
    }): Promise<Collection | null> => {
      try {
        const res = await fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });
        if (res.ok) {
          const col: Collection = await res.json();
          setCollections((prev) => [...prev, col]);
          return col;
        }
      } catch (err) {
        console.error("Failed to create collection:", err);
      }
      return null;
    },
    [],
  );

  const updateCollection = useCallback(
    async (
      id: string,
      updates: { name?: string; sortOrder?: number },
    ): Promise<Collection | null> => {
      try {
        const res = await fetch(`/api/collections/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const col: Collection = await res.json();
          setCollections((prev) => {
            const next = prev.map((c) => (c.id === id ? col : c));
            // Re-sort by sortOrder to keep local state consistent with server order
            return [...next].sort((a, b) => a.sortOrder - b.sortOrder);
          });
          return col;
        }
      } catch (err) {
        console.error("Failed to update collection:", err);
      }
      return null;
    },
    [],
  );

  const deleteCollection = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
        if (res.ok) {
          setCollections((prev) => prev.filter((c) => c.id !== id));
          return true;
        }
      } catch (err) {
        console.error("Failed to delete collection:", err);
      }
      return false;
    },
    [],
  );

  return { collections, loading, refresh, createCollection, updateCollection, deleteCollection };
}
