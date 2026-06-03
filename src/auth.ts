// src/auth.ts — Auth.js (NextAuth v5) with Google sign-in. PRD §9.1.
// JWT session (no DB adapter needed); the app user id is `google:<sub>`. Falls back to the
// signed-cookie guest session for users who don't log in. Reads GOOGLE_CLIENT_ID/SECRET + AUTH_SECRET.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
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
});
