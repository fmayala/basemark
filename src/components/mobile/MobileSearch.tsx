"use client";

import { useState, useRef, useEffect } from "react";
import { useSearch } from "@/hooks/useSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MobileSearchProps {
  onSelectResult: (id: string) => void;
  onClose: () => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export default function MobileSearch({ onSelectResult, onClose }: MobileSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, search } = useSearch();

  useEffect(() => {
    // Small delay to let the slide-up animation finish before focusing
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);
  };

  const showEmpty = query.length >= 2 && results.length === 0;
  const showInitial = query.length < 2;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Results area — grows upward from bottom, takes remaining space */}
      <div className="flex-1 overflow-y-auto flex flex-col justify-end">
        {showInitial && (
          <div className="flex items-center justify-center flex-1">
            <span className="text-text-ghost text-sm">Search your notes</span>
          </div>
        )}

        {showEmpty && (
          <div className="flex items-center justify-center flex-1">
            <span className="text-text-ghost text-sm">No results found</span>
          </div>
        )}

        {!showInitial && results.length > 0 && (
          <div>
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="w-full px-4 py-3 border-b border-border/20 text-left bg-transparent border-x-0 border-t-0 cursor-pointer font-inherit active:bg-bg-hover transition-colors duration-100"
                onClick={() => onSelectResult(result.id)}
              >
                <div className="text-mobile-input text-text-primary truncate">{result.title}</div>
                <div className="text-ui text-text-faint truncate mt-0.5">
                  {stripHtml(result.snippet)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search input — pinned to bottom, thumb-friendly */}
      <div className="shrink-0 bg-bg-sidebar border-t border-border/20 px-3 py-2 safe-bottom">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleChange}
            placeholder="Search notes..."
            className="flex-1 h-10 text-mobile-input"
          />
          <Button
            variant="link"
            onClick={onClose}
            className="shrink-0 text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
