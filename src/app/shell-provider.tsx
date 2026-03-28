"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { SessionProvider } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileShell from "@/components/mobile/MobileShell";

const EXCLUDED_PATHS = ["/login", "/share/"];

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  // Wait for client mount to avoid hydration mismatch
  // (server always renders nothing, client picks mobile or desktop)
  useEffect(() => {
    setMounted(true);
  }, []);

  const shouldExclude = EXCLUDED_PATHS.some((p) => pathname.startsWith(p));

  // During SSR and first client render, show a minimal loading state
  // to avoid hydration mismatch between server (no window) and client
  if (!mounted && !shouldExclude) {
    return (
      <MotionConfig reducedMotion="never">
        <SessionProvider>
          <div className="h-screen w-screen bg-bg-primary" />
        </SessionProvider>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="never">
      <SessionProvider>
        {shouldExclude ? (
          children
        ) : isMobile ? (
          <MobileShell />
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </SessionProvider>
    </MotionConfig>
  );
}
