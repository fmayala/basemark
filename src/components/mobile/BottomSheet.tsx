"use client";

import { Drawer } from "vaul";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[1000]" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[1001] bg-bg-sidebar rounded-t-2xl outline-none">
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-text-ghost/30 rounded-full" />
          </div>
          {title && (
            <Drawer.Title className="text-mobile-input font-semibold text-text-primary px-5 pb-3 m-0">
              {title}
            </Drawer.Title>
          )}
          <div className="px-5 pb-6 safe-bottom max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
