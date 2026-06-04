// src/auth.ts — Auth.js (NextAuth v5) with Google sign-in. PRD §9.1.
// JWT session (no DB adapter needed); the app user id is `google:<sub>`. Falls back to the
// signed-cookie guest session for users who don't log in. Reads GOOGLE_CLIENT_ID/SECRET + AUTH_SECRET.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authSecret } from "@/server/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret(),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile !== undefined && typeof profile.sub === "string") {
        (token as Record<string, unknown>)["gsub"] = profile.sub;
      }
      return token;
    },
    session({ session, token }) {
      const sub = (token as Record<string, unknown>)["gsub"];
      if (typeof sub === "string" && session.user !== undefined) {
        (session.user as { id?: string }).id = `google:${sub}`;
      }
      return session;
    },
  },
  events: {
    // Persist the real Google identity (email, name, avatar) to Postgres on every sign-in.
    // Best-effort + dynamic import: never block login, never pull Prisma into the edge bundle. PRD §9.1, §11.2.
    async signIn({ user, profile }) {
      if (profile === undefined || typeof profile.sub !== "string") return;
      const sub = profile.sub;
      if (typeof process.env.DATABASE_URL !== "string" || process.env.DATABASE_URL.length === 0) return;
      try {
        const { persistGoogleUser } = await import("./server/db/auth-user");
        await persistGoogleUser(`google:${sub}`, {
          sub,
          email: user.email ?? (typeof profile.email === "string" ? profile.email : null),
          name: user.name ?? (typeof profile.name === "string" ? profile.name : null),
          picture: user.image ?? (typeof profile.picture === "string" ? profile.picture : null),
        });
      } catch {
        // swallow — sign-in must succeed even if persistence fails.
      }
    },
  },
});
