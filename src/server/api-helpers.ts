// src/server/api-helpers.ts — session helpers for Route Handlers / server components.
// Login is REQUIRED: the only identity is the Google (Auth.js) user `google:<sub>`. There is no guest
// session — unauthenticated callers get null (routes return 401; pages redirect to sign-in).

import { NextResponse } from "next/server";
import { auth } from "@/auth";

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
 * CSRF defense for cookie-authenticated mutating routes: require the request to be same-origin.
 * Browsers always attach `Origin` (and/or `Sec-Fetch-Site`) to cross-site mutations; a forged
 * cross-site POST therefore fails this check. Same-origin app fetches pass. PRD §13.4.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin !== null && origin !== "") {
    const host = req.headers.get("host");
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  // No Origin (e.g. same-origin navigations / non-browser clients): fall back to Fetch Metadata.
  const site = req.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}

/** Returns a 403 response when the mutation is cross-origin, else null (proceed). */
export function guardMutation(req: Request): NextResponse | null {
  if (isSameOrigin(req)) return null;
  return NextResponse.json({ error: "Permintaan lintas-asal ditolak." }, { status: 403 });
}
