"use client";

import { useEffect, useState, use } from "react";
import { signIn, useSession } from "next-auth/react";
import SharedDocView from "./shared-doc-view";
import { Button } from "@/components/ui/button";

type PageState =
  | "loading"
  | "ready"
  | "auth_required"
  | "denied"
  | "expired"
  | "not_found";

interface Doc {
  id: string;
  title: string;
  content: string;
}

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data: session } = useSession();
  const [state, setState] = useState<PageState>("loading");
  const [doc, setDoc] = useState<Doc | null>(null);

  useEffect(() => {
    setState("loading");
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (res.ok) {
          setDoc(await res.json());
          setState("ready");
        } else if (res.status === 401) {
          setState("auth_required");
        } else if (res.status === 403) {
          setState("denied");
        } else if (res.status === 410) {
          setState("expired");
        } else {
          setState("not_found");
        }
      })
      .catch(() => setState("not_found"));
  }, [token, session]);

  if (state === "loading") {
    return <CenteredMessage>Loading...</CenteredMessage>;
  }

  if (state === "auth_required") {
    return (
      <CenteredMessage>
        <p className="text-text-secondary text-mobile-input mb-4">
          Sign in to view this document
        </p>
        <Button onClick={() => signIn("google")}>
          Sign in with Google
        </Button>
      </CenteredMessage>
    );
  }

  if (state === "denied") {
    return (
      <CenteredMessage>You don&apos;t have access to this document.</CenteredMessage>
    );
  }

  if (state === "expired") {
    return <CenteredMessage>This link has expired.</CenteredMessage>;
  }

  if (state === "not_found") {
    return <CenteredMessage>Document not found.</CenteredMessage>;
  }

  // state === "ready"
  return (
    <div className="min-h-screen bg-bg-primary flex justify-center">
      <div className="w-full max-w-[860px] px-4 sm:px-8 lg:px-14 py-12">
        <div className="font-title text-[1.875rem] sm:text-display font-normal leading-[1.25] text-text-primary mb-6">
          {doc?.title || "Untitled"}
        </div>
        <SharedDocView content={doc?.content ?? ""} />
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <div className="text-center text-text-faint">{children}</div>
    </div>
  );
}
