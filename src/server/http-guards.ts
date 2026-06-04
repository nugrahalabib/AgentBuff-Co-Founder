// src/server/http-guards.ts — framework-level request guards with NO auth/session dependency, so
// bearer-token routes (MCP, OAuth token/register) can use them WITHOUT pulling in the next-auth chain.
// Session helpers that need Auth.js live in api-helpers.ts (which re-exports these for convenience).

import { NextResponse } from "next/server";

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

/** Best-effort client IP for rate-limiting unauthenticated routes (behind a proxy: X-Forwarded-For). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff !== null && xff !== "") return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Reject an oversized request body early (before parsing) using Content-Length. Best-effort: a missing
 * or spoofed header isn't caught, but it cheaply blocks the obvious large-payload case. Returns a 413
 * response when over the cap, else null. (DOS-005)
 */
export function enforceBodyLimit(req: Request, maxBytes: number): NextResponse | null {
  const len = req.headers.get("content-length");
  if (len !== null && Number(len) > maxBytes) {
    return NextResponse.json({ error: "Payload terlalu besar." }, { status: 413 });
  }
  return null;
}

/**
 * Minimal in-memory fixed-window rate limiter for auth-adjacent routes (PRD §13.2). Best-effort and
 * per-instance (resets on restart / not shared across serverless instances) — a deterrent against
 * runaway loops / key-validation oracles, not a hard quota. Returns a 429 response when over the cap,
 * else null (proceed). Replace with a Redis token-bucket when the BullMQ/Redis seam goes live.
 */
const rlBuckets =
  (globalThis as unknown as { __rlBuckets?: Map<string, { count: number; resetAt: number }> }).__rlBuckets ??
  ((globalThis as unknown as { __rlBuckets?: Map<string, { count: number; resetAt: number }> }).__rlBuckets = new Map());

export function rateLimit(key: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const b = rlBuckets.get(key);
  if (b === undefined || now >= b.resetAt) {
    rlBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (b.count >= max) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }
  b.count += 1;
  return null;
}
