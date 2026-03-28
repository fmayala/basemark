"use client";

import { useState, useRef } from "react";

interface MobileNoteRowProps {
  title: string;
  preview?: string;
  collectionName?: string;
  updatedAt: number; // unix seconds
  onClick: () => void;
  onDelete: () => void;
}

function timeAgo(unixSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SWIPE_THRESHOLD = 80;

export function MobileNoteRow({
  title,
  preview,
  collectionName,
  updatedAt,
  onClick,
  onDelete,
}: MobileNoteRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setTransitioning(false);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    // Only allow left swipe (negative delta)
    if (delta < 0) {
      setOffsetX(Math.max(delta, -SWIPE_THRESHOLD - 20));
    }
  }

  function handleTouchEnd() {
    if (touchStartX.current === null) return;
    touchStartX.current = null;
    setTransitioning(true);
    if (offsetX <= -SWIPE_THRESHOLD) {
      // Snap to fully-revealed delete state then invoke delete
      setOffsetX(-SWIPE_THRESHOLD);
      setTimeout(() => {
        onDelete();
        setOffsetX(0);
      }, 200);
    } else {
      setOffsetX(0);
    }
  }

  const showDelete = offsetX <= -SWIPE_THRESHOLD;

  return (
    <div className="relative overflow-hidden border-b border-border/20">
      {/* Red delete background — only visible when swiping beyond 2px */}
      {offsetX < -2 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-danger"
          style={{ width: Math.max(Math.abs(offsetX), SWIPE_THRESHOLD) }}
        >
          <span className="text-white text-base font-semibold">Delete</span>
        </div>
      )}

      {/* Row content — extends 2px past right edge to prevent subpixel bleed */}
      <div
        role="button"
        tabIndex={0}
        onClick={showDelete ? undefined : onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-bg-primary py-4 px-5 cursor-pointer select-none active:bg-bg-hover/40 flex items-start gap-3.5 -mr-[2px] pr-[22px]"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: transitioning ? "transform 0.2s ease" : "none",
        }}
      >
        {/* Document icon */}
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-dimmed shrink-0 mt-0.5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <div className="text-mobile-title text-text-primary truncate leading-snug">
            {title || "Untitled"}
          </div>

          {/* Preview */}
          {preview && (
            <div className="text-sm text-text-faint truncate mt-1 leading-snug">
              {preview}
            </div>
          )}

          {/* Bottom line: collection + time */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {collectionName && (
              <>
                <span className="text-ui text-text-ghost truncate">{collectionName}</span>
                <span className="text-ui text-text-ghost opacity-40">·</span>
              </>
            )}
            <span className="text-ui text-text-ghost shrink-0">{timeAgo(updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
