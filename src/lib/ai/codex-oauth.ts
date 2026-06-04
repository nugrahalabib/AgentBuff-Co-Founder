// src/lib/ai/codex-oauth.ts
// Codex "Sign in with ChatGPT" OAuth: PKCE (S256) authorization-code flow against auth.openai.com,
// token exchange, rotating-refresh-token handling, and id_token decoding for the chatgpt-account-id.
// Pure-ish: only node:crypto + fetch. No I/O to our DB here (the registry persists the bundle). PRD §12.16.

import { createHash, randomBytes } from "node:crypto";
import { CODEX_OAUTH, CODEX_REFRESH_LEAD_MS, CODEX_UNRECOVERABLE_ERRORS } from "./codex-config";

/** What we persist (envelope-encrypted) for a linked Codex account. */
export interface CodexTokenBundle {
  accessToken: string;
  /** Rotating refresh token; absent for an imported bare access token (no refresh possible). */
  refreshToken?: string;
  /** The `chatgpt-account-id` header value, decoded from the id_token. */
  chatgptAccountId?: string;
  chatgptPlanType?: string;
  email?: string;
  /** Epoch ms when the access token expires (best-effort: from expires_in or the JWT `exp`). */
  expiresAt: number;
}

export class CodexAuthError extends Error {
  constructor(
    message: string,
    /** true when the refresh-token family is dead → the user MUST re-login (no silent retry). */
    readonly unrecoverable: boolean,
  ) {
    super(message);
    this.name = "CodexAuthError";
  }
}

// ---------------------------------------------------------------------------
// PKCE + state (RFC 7636 S256)
// ---------------------------------------------------------------------------

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

export function generatePkce(): Pkce {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(randomBytes(32));
}

/**
 * Build the authorize URL by hand so spaces in `scope` encode as %20 (not '+') — the Codex
 * authorize endpoint is strict about this. Mirrors the codex CLI / 9router exactly.
 */
export function buildAuthorizeUrl(params: { challenge: string; state: string; redirectUri?: string }): string {
  const q: Record<string, string> = {
    response_type: "code",
    client_id: CODEX_OAUTH.clientId,
    redirect_uri: params.redirectUri ?? CODEX_OAUTH.redirectUri,
    scope: CODEX_OAUTH.scope,
    code_challenge: params.challenge,
    code_challenge_method: CODEX_OAUTH.codeChallengeMethod,
    state: params.state,
    ...CODEX_OAUTH.extraAuthorizeParams,
  };
  const query = Object.entries(q)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${CODEX_OAUTH.authorizeUrl}?${query}`;
}

// ---------------------------------------------------------------------------
// JWT decode (id_token / access_token claims) — decode only, no signature verify (we trust the
// channel: the token came straight from OpenAI's token endpoint over TLS, or was pasted by the user).
// ---------------------------------------------------------------------------

interface CodexClaims {
  exp?: number;
  email?: string;
  ["https://api.openai.com/auth"]?: { chatgpt_account_id?: string; chatgpt_plan_type?: string };
  ["https://api.openai.com/profile"]?: { email?: string };
}

function decodeJwt(token: string): CodexClaims | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as CodexClaims;
  } catch {
    return null;
  }
}

/** Pull account id / plan / email out of the id_token (preferred) or the access_token. */
export function decodeAccountInfo(idOrAccessToken: string): {
  chatgptAccountId?: string;
  chatgptPlanType?: string;
  email?: string;
  exp?: number;
} {
  const c = decodeJwt(idOrAccessToken);
  if (c === null) return {};
  const auth = c["https://api.openai.com/auth"];
  const profile = c["https://api.openai.com/profile"];
  return {
    chatgptAccountId: auth?.chatgpt_account_id,
    chatgptPlanType: auth?.chatgpt_plan_type,
    email: profile?.email ?? c.email,
    exp: c.exp,
  };
}

// ---------------------------------------------------------------------------
// Token endpoint (exchange + refresh) — public client, x-www-form-urlencoded, no client_secret.
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Ceiling on a token's assumed lifetime, so a malformed/forged JWT `exp` can't suppress refresh. */
const MAX_EXPIRY_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

function clampExpiry(ms: number): number {
  return Math.min(ms, Date.now() + MAX_EXPIRY_HORIZON_MS);
}

function expiryFrom(token: TokenResponse, idToken: string | undefined, accessToken: string): number {
  if (typeof token.expires_in === "number" && token.expires_in > 0) {
    return clampExpiry(Date.now() + token.expires_in * 1000);
  }
  // Fall back to the JWT `exp` (seconds) of id_token, then access_token.
  const exp = decodeAccountInfo(idToken ?? "").exp ?? decodeAccountInfo(accessToken).exp;
  if (typeof exp === "number") return clampExpiry(exp * 1000);
  return Date.now() + 60 * 60 * 1000; // conservative 1h default
}

function bundleFromToken(token: TokenResponse): CodexTokenBundle {
  const accessToken = token.access_token;
  if (accessToken === undefined || accessToken === "") {
    throw new CodexAuthError("Respons token tidak berisi access_token.", false);
  }
  const info = decodeAccountInfo(token.id_token ?? accessToken);
  return {
    accessToken,
    refreshToken: token.refresh_token,
    chatgptAccountId: info.chatgptAccountId,
    chatgptPlanType: info.chatgptPlanType,
    email: info.email,
    expiresAt: expiryFrom(token, token.id_token, accessToken),
  };
}

async function postToken(formBody: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(CODEX_OAUTH.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(formBody).toString(),
    });
  } catch {
    throw new CodexAuthError("Gagal menghubungi server token OpenAI.", false);
  }
  let data: TokenResponse;
  try {
    data = (await res.json()) as TokenResponse;
  } catch {
    if (!res.ok) throw new CodexAuthError(`Server token OpenAI error ${res.status}.`, false);
    throw new CodexAuthError("Respons token OpenAI tidak bisa dibaca.", false);
  }
  if (data.error !== undefined && data.error !== "") {
    const unrecoverable = CODEX_UNRECOVERABLE_ERRORS.has(data.error);
    throw new CodexAuthError(data.error_description ?? data.error, unrecoverable);
  }
  if (!res.ok) throw new CodexAuthError(`Server token OpenAI error ${res.status}.`, false);
  return data;
}

/** Exchange an authorization code (after the loopback callback) for a token bundle. */
export async function exchangeCode(params: { code: string; verifier: string; redirectUri?: string }): Promise<CodexTokenBundle> {
  const token = await postToken({
    grant_type: "authorization_code",
    client_id: CODEX_OAUTH.clientId,
    code: params.code,
    redirect_uri: params.redirectUri ?? CODEX_OAUTH.redirectUri,
    code_verifier: params.verifier,
  });
  return bundleFromToken(token);
}

/**
 * Refresh an access token. Refresh tokens ROTATE (one-time-use): the response MAY contain a new
 * refresh_token which MUST replace the old one. On an unrecoverable error the caller must force re-login.
 */
export async function refreshTokens(bundle: CodexTokenBundle): Promise<CodexTokenBundle> {
  if (bundle.refreshToken === undefined || bundle.refreshToken === "") {
    throw new CodexAuthError("Tidak ada refresh token (sesi impor) — silakan login ulang.", true);
  }
  const token = await postToken({
    grant_type: "refresh_token",
    client_id: CODEX_OAUTH.clientId,
    refresh_token: bundle.refreshToken,
    scope: CODEX_OAUTH.scope,
  });
  const next = bundleFromToken(token);
  // Carry forward fields the refresh response may omit; ALWAYS keep the rotated refresh token.
  return {
    ...bundle,
    accessToken: next.accessToken,
    refreshToken: next.refreshToken ?? bundle.refreshToken,
    chatgptAccountId: next.chatgptAccountId ?? bundle.chatgptAccountId,
    chatgptPlanType: next.chatgptPlanType ?? bundle.chatgptPlanType,
    email: next.email ?? bundle.email,
    expiresAt: next.expiresAt,
  };
}

/** True when the access token is within the proactive refresh lead (or already expired). */
export function needsRefresh(bundle: CodexTokenBundle, now: number = Date.now()): boolean {
  return bundle.expiresAt - now < CODEX_REFRESH_LEAD_MS;
}

// ---------------------------------------------------------------------------
// Bundle (de)serialization — stored as the envelope-encrypted "secret" of a codex credential, so no
// Prisma schema change is needed (refresh token + account id + expiry all live inside the ciphertext).
// ---------------------------------------------------------------------------

export function serializeBundle(bundle: CodexTokenBundle): string {
  return JSON.stringify(bundle);
}

export function parseBundle(secret: string): CodexTokenBundle {
  const b = JSON.parse(secret) as CodexTokenBundle;
  if (typeof b.accessToken !== "string" || b.accessToken === "") {
    throw new CodexAuthError("Bundle token Codex rusak.", true);
  }
  if (typeof b.expiresAt !== "number") b.expiresAt = 0;
  return b;
}

/** Build a bundle from a bare pasted ChatGPT access-token JWT (no refresh token → re-paste on expiry). */
export function bundleFromAccessToken(accessToken: string): CodexTokenBundle {
  const info = decodeAccountInfo(accessToken);
  return {
    accessToken,
    chatgptAccountId: info.chatgptAccountId,
    chatgptPlanType: info.chatgptPlanType,
    email: info.email,
    expiresAt: info.exp !== undefined ? clampExpiry(info.exp * 1000) : Date.now() + 60 * 60 * 1000,
  };
}
