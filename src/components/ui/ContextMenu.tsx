"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import BottomSheet from "@/components/mobile/BottomSheet";
import { Separator } from "@/components/ui/separator";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// For mobile: bottom sheet action list
function MobileContextMenu({ items, onClose }: { items: ContextMenuItem[]; onClose: () => void }) {
  return (
    <BottomSheet open={true} onClose={onClose}>
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left py-3 text-mobile-input bg-transparent border-0 border-b border-border/20 cursor-pointer font-inherit ${
            item.danger ? "text-danger" : "text-text-primary"
          }`}
        >
          {item.label}
        </button>
      ))}
    </BottomSheet>
  );
}

// For desktop: positioned dropdown
export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileContextMenu items={items} onClose={onClose} />;

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed bg-bg-input border border-border-subtle rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-[9999] min-w-[160px] py-1"
        style={{ left: x, top: y }}
      >
        {items.filter(i => !i.danger).map((item) => (
          <button
            key={item.label}
            onClick={() => { item.onClick(); onClose(); }}
            className="block w-full min-h-9 bg-transparent border-none px-3 py-1.5 cursor-pointer text-text-primary text-ui font-inherit text-left hover:bg-bg-hover transition-colors duration-150"
          >
            {item.label}
          </button>
        ))}
        {items.some(i => i.danger) && <Separator className="mx-2 my-0.5" />}
        {items.filter(i => i.danger).map((item) => (
          <button
            key={item.label}
            onClick={() => { item.onClick(); onClose(); }}
            className="block w-full min-h-9 bg-transparent border-none px-3 py-1.5 cursor-pointer text-danger text-ui font-inherit text-left hover:bg-bg-hover transition-colors duration-150"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
