"use client";

import { useRef, useEffect, useCallback } from "react";

interface DocTitleProps {
  title: string;
  onChange: (title: string) => void;
}

export default function DocTitle({ title, onChange }: DocTitleProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  useEffect(() => {
    resize();
  }, [title, resize]);

  return (
    <textarea
      ref={ref}
      value={title}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
      onKeyDown={(e) => {
        // Prevent newlines in the title
        if (e.key === "Enter") e.preventDefault();
      }}
      rows={1}
      placeholder="Untitled"
      aria-label="Document title"
      className="block w-full resize-none overflow-hidden bg-transparent border-none outline-none font-title text-[1.875rem] sm:text-display font-normal leading-[1.25] text-text-primary p-0 mb-6"
    />
  );
}
