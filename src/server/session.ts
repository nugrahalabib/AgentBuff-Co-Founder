// src/server/session.ts
// Lightweight signed-cookie session (no external dep). Good enough for local/dev & guest sessions;
// swap for Auth.js + Google OIDC in prod (PRD §9.1) by setting GOOGLE_CLIENT_ID/SECRET. The cookie
// holds an HMAC-signed user id only — no secrets.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ab_session";
const SECRET = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";

export function signSession(userId: string): string {
  const sig = createHmac("sha256", SECRET).update(userId).digest("base64url");
  return `${userId}.${sig}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (token === undefined || token === null) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(userId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

/** Parse the session user id out of a raw Cookie header (for Route Handlers). */
export function readUserIdFromCookieHeader(header: string | null): string | null {
  if (header === null) return null;
  const part = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (part === undefined) return null;
  return verifySession(decodeURIComponent(part.slice(SESSION_COOKIE.length + 1)));
}
