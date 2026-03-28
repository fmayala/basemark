"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((query: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    abortRef.current?.abort();
    abortRef.current = null;

    if (query.length < 2) {
      requestIdRef.current += 1;
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json().catch(() => []);
          if (requestId === requestIdRef.current) {
            setResults(data);
          }
        } else if (requestId === requestIdRef.current) {
          setResults([]);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Failed to fetch search results:", err);
          if (requestId === requestIdRef.current) {
            setResults([]);
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  return { results, loading, search };
}
