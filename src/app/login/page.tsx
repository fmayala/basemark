"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This account is not authorized. Only the workspace owner can sign in.",
  OAuthSignin: "Could not start the sign-in flow. Try again.",
  OAuthCallback: "Sign-in was interrupted. Try again.",
  OAuthAccountNotLinked: "This email is already linked to another account.",
  Callback: "Something went wrong during sign-in. Try again.",
  Default: "An unexpected error occurred. Try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default
    : null;
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    setLoading(true);
    signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        className="w-full max-w-[360px] flex flex-col items-center gap-7"
      >
        <div className="flex items-center gap-3">
          <h1 className="font-title text-4xl font-normal text-text-primary m-0 tracking-tight">
            Basemark
          </h1>
          <Logo size={44} className="text-text-primary" />
        </div>

        <div className="w-full flex flex-col gap-3">
          {/* Error message */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                className="w-full bg-danger/10 border border-danger/20 rounded-md px-4 py-3 text-ui text-danger"
                role="alert"
              >
                {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign in button */}
          <Button
            variant="outline"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full h-auto py-3 text-mobile-input gap-3"
          >
            {loading ? (
              <span className="text-text-faint">Redirecting to Google...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </>
            )}
          </Button>
        </div>

        {/* Subtle footer */}
        <p className="text-xs text-text-ghost text-center">
          Only the workspace owner can sign in.
        </p>
      </motion.div>
    </div>
  );
}

// Suspense boundary needed because useSearchParams() triggers client-side rendering
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <span className="text-text-faint text-sm">Loading...</span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
