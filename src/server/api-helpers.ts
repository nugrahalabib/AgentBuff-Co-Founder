// src/server/api-helpers.ts — session helpers for Route Handlers / server components.
// Login is REQUIRED: the only identity is the Google (Auth.js) user `google:<sub>`. Unauthenticated
// callers get null (routes return 401; pages redirect to sign-in).
//
// The framework-level guards (CSRF/rate-limit/body-size) live in http-guards.ts so bearer-token routes
// can use them without importing the next-auth chain; they are re-exported here for session routes.

import type { Session } from "next-auth";
import { auth } from "@/auth";

export { isSameOrigin, guardMutation, clientIp, enforceBodyLimit, rateLimit } from "@/server/http-guards";

/** The signed-in Google user id (`google:<sub>`), or null if not authenticated. */
async function googleUserId(): Promise<string | null> {
  try {
    const session = await auth();
    const id = (session?.user as { id?: string } | undefined)?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Acting user for Route Handlers (or null when not logged in). */
export async function currentUserId(_req?: Request): Promise<string | null> {
  return googleUserId();
}

/** Acting user for server components (or null when not logged in). */
export async function getServerUserId(): Promise<string | null> {
  return googleUserId();
}

/**
 * Full session for server components, but NEVER throws — a stale/undecryptable cookie (old AUTH_SECRET)
 * resolves to null (treated as logged out) instead of crashing the page. Use this in server pages that
 * need `session.user`, rather than calling `auth()` directly.
 */
export async function getServerSession(): Promise<Session | null> {
  try {
    return await auth();
  } catch {
    return null;
  }
}
