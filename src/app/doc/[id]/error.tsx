"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DocError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-8 lg:px-14 py-12">
      <div className="text-center">
        <h2 className="text-lg font-body text-text-primary mb-2">
          Failed to load document
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          {error.message || "An unexpected error occurred while loading this document."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
