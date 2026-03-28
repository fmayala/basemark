"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useSearch, type SearchResult } from "@/hooks/useSearch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchViewProps {
  onResultClick: (result: SearchResult) => void;
  /** When provided, SearchView is controlled — uses this query and hides its own input */
  externalQuery?: string;
  /** Increment to focus the internal input (only used when externalQuery is not provided) */
  focusSignal?: number;
}

function renderSnippet(snippet: string): ReactNode {
  if (!snippet) return "";
  const parts = snippet.split(/(<mark>|<\/mark>)/g).filter(Boolean);
  const rendered: ReactNode[] = [];
  let isHighlighted = false;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === "<mark>") { isHighlighted = true; continue; }
    if (part === "</mark>") { isHighlighted = false; continue; }
    rendered.push(
      isHighlighted ? (
        <mark key={i} className="bg-bg-hover text-text-primary rounded-sm px-0.5">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }
  return rendered;
}

export default function SearchView({ onResultClick, externalQuery, focusSignal }: SearchViewProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const { results, loading, search } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  const activeQuery = externalQuery ?? internalQuery;

  // Trigger search whenever the active query changes
  useEffect(() => {
    search(activeQuery);
  }, [activeQuery, search]);

  // Focus the internal input on signal (standalone mode only)
  useEffect(() => {
    if (focusSignal && externalQuery === undefined) {
      inputRef.current?.focus();
    }
  }, [focusSignal, externalQuery]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {externalQuery === undefined && (
        <div className="px-3 py-2">
          <Label htmlFor="sidebar-search" className="sr-only">Search documents</Label>
          <Input
            id="sidebar-search"
            ref={inputRef}
            type="text"
            placeholder="Search documents..."
            value={internalQuery}
            onChange={(e) => setInternalQuery(e.target.value)}
            className="text-sm"
          />
        </div>
      )}
      <ScrollArea className="flex-1 pb-2">
        {loading && (
          <div className="px-3 py-2 text-sm text-text-faint">Searching...</div>
        )}
        {!loading && activeQuery.length >= 2 && results.length === 0 && (
          <div className="px-3 py-2 text-sm text-text-faint">No results</div>
        )}
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => onResultClick(r)}
            className="block w-full bg-transparent border-none px-3 py-1.5 cursor-pointer text-left font-inherit hover:bg-bg-hover transition-colors duration-150"
          >
            <div className="text-sm text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
              {r.title || "Untitled"}
            </div>
            <div className="text-ui text-text-faint overflow-hidden text-ellipsis whitespace-nowrap mt-0.5">
              {renderSnippet(r.snippet)}
            </div>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}
