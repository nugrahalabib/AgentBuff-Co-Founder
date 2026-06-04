// src/server/http-guards.ts — framework-level request guards with NO auth/session dependency, so
// bearer-token routes (MCP, OAuth token/register) can use them WITHOUT pulling in the next-auth chain.
// Session helpers that need Auth.js live in api-helpers.ts (which re-exports these for convenience).

import { NextResponse } from "next/server";
import { getRedis } from "@/server/redis";

/** Header set for authenticated GETs that return per-user data — keeps PII out of proxy/bfcache/SW caches. */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

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

/** Fixed-window rate limiter for auth-adjacent routes (PRD §13.2). Uses Redis when REDIS_URL is set
 * (shared across instances — survives restarts + horizontal scaling), else a per-instance in-memory
 * fallback. Returns a 429 response when over the cap, else null (proceed). This is an app-level deterrent
 * against abuse / key-validation oracles, NOT DDoS protection — put a CDN/WAF (Cloudflare) in front for
 * that. See docs/PRODUCTION-SECURITY.md. */
const tooMany = (retrySec: number): NextResponse =>
  NextResponse.json(
    { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retrySec)) } },
  );

const rlBuckets =
  (globalThis as unknown as { __rlBuckets?: Map<string, { count: number; resetAt: number }> }).__rlBuckets ??
  ((globalThis as unknown as { __rlBuckets?: Map<string, { count: number; resetAt: number }> }).__rlBuckets = new Map());

function rateLimitMemory(key: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const b = rlBuckets.get(key);
  if (b === undefined || now >= b.resetAt) {
    rlBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (b.count >= max) return tooMany(Math.ceil((b.resetAt - now) / 1000));
  b.count += 1;
  return null;
}

export async function rateLimit(key: string, max: number, windowMs: number): Promise<NextResponse | null> {
  try {
    const redis = await getRedis();
    if (redis !== null) {
      const k = `rl:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.pexpire(k, windowMs);
      if (count > max) return tooMany(Math.ceil((await redis.pttl(k)) / 1000));
      return null;
    }
  } catch {
    // Redis hiccup → fail open to the in-memory limiter rather than blocking legitimate users.
  }
  return rateLimitMemory(key, max, windowMs);
}
