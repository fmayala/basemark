import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { isOwnerEmail } from "@/lib/authz";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      // Allow unauthenticated access to share pages (they handle their own auth)
      if (request.nextUrl.pathname.startsWith("/share/")) return true;
      // Allow unauthenticated access to share API (it handles its own auth)
      if (request.nextUrl.pathname.startsWith("/api/share/")) return true;
      if (!auth?.user) return false;
      return isOwnerEmail(auth.user.email);
    },
    signIn({ user }) {
      // Allow any Google user to sign in so invited users can access shared docs.
      // Owner-only access to the main app is enforced by authorized()/requireAuth().
      // Keep an explicit owner fast-path to avoid regressions if this callback grows.
      if (isOwnerEmail(user.email)) return true;
      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
