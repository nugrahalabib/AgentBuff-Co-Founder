// src/server/session.ts
// Lightweight signed-cookie session (no external dep). Good enough for local/dev & guest sessions;
// swap for Auth.js + Google OIDC in prod (PRD §9.1) by setting GOOGLE_CLIENT_ID/SECRET. The cookie
// holds an HMAC-signed user id only — no secrets.

import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "./env";

export const SESSION_COOKIE = "ab_session";
/** Token validity window (30 days). Embedded in the signed payload so it can't be extended client-side. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Sign a session token: `userId.exp.hmac(userId.exp)`. `now` is injectable for tests. */
export function signSession(userId: string, now: number = Date.now()): string {
  const payload = `${userId}.${now + SESSION_TTL_MS}`;
  const sig = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined | null, now: number = Date.now()): string | null {
  if (token === undefined || token === null) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const sep = payload.lastIndexOf(".");
  if (sep <= 0) return null;
  const userId = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!Number.isFinite(exp) || now > exp) return null;
  return userId;
}

/** Parse the session user id out of a raw Cookie header (for Route Handlers). */
export function readUserIdFromCookieHeader(header: string | null): string | null {
  if (header === null) return null;
  const part = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (part === undefined) return null;
  return verifySession(decodeURIComponent(part.slice(SESSION_COOKIE.length + 1)));
}
