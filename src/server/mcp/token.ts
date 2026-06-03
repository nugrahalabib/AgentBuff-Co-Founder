// src/server/mcp/token.ts — MCP personal access tokens for the Streamable-HTTP gateway. PRD §9.6.5, §13.1.
// The plaintext token is shown to the user exactly once; we persist only its SHA-256 hash (+ a short
// prefix for recognition). Auth = SHA-256(presented) === stored hash. No secret is recoverable from the DB.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "mcp_";

export interface IssuedToken {
  /** Full plaintext token — return to the user once, never store. */
  token: string;
  /** SHA-256 hex of the token — safe to persist/index. */
  hash: string;
  /** Short, non-sensitive prefix for display (e.g. "mcp_AbC1…"). */
  display: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Generate a new MCP token (256 bits of entropy, base64url). */
export function generateToken(): IssuedToken {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), display: `${token.slice(0, 11)}…` };
}

/** Extract the bearer token from an Authorization header, or null. */
export function bearerFromHeader(header: string | null): string | null {
  if (header === null) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match !== null ? match[1]!.trim() : null;
}

/** Constant-time comparison of two hex hashes (avoids timing oracles). */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
