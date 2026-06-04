// src/server/env.ts — fail-closed secret/env access. PRD §13.1.
// In production, required secrets MUST be present (no insecure fallbacks → no forgeable sessions,
// no per-process KEK that would silently make all stored BYOK ciphertext undecryptable on restart).
import "server-only"; // build-time guard: importing this into a client component is a hard error

const isProd = process.env.NODE_ENV === "production";

/** Auth.js session secret (signs the JWT session). Throws in prod if missing/weak. */
export function authSecret(): string {
  const v = process.env.AUTH_SECRET;
  if (v !== undefined && v.length >= 16) return v;
  if (isProd) {
    throw new Error("AUTH_SECRET is required (>= 16 chars) in production — refusing to start with a forgeable session secret.");
  }
  return "dev-insecure-secret-change-me";
}

/** True when a KMS-backed KEK is configured (an acceptable prod alternative to BYOK_MASTER_KEY_BASE64). */
export function kmsConfigured(): boolean {
  return (process.env.BYOK_KMS_KEY_ID ?? "") !== "" && (process.env.BYOK_KEK_CIPHERTEXT_B64 ?? "") !== "";
}

/** Base64 KEK for BYOK envelope encryption, or null (dev, or when KMS provides the KEK instead). */
export function byokMasterKeyBase64(): string | null {
  const v = process.env.BYOK_MASTER_KEY_BASE64;
  if (v !== undefined && v.length > 0) {
    // Validate early with a precise message rather than failing deep inside LocalMasterKey.
    if (Buffer.from(v, "base64").length !== 32) {
      throw new Error("BYOK_MASTER_KEY_BASE64 must decode to exactly 32 bytes (e.g. `openssl rand -base64 32`).");
    }
    return v;
  }
  if (isProd && !kmsConfigured()) {
    throw new Error(
      "In production set BYOK_MASTER_KEY_BASE64 (32 bytes base64) OR configure KMS (BYOK_KMS_KEY_ID + BYOK_KEK_CIPHERTEXT_B64) — a per-process random KEK would make all stored BYOK keys undecryptable after restart.",
    );
  }
  return null;
}
