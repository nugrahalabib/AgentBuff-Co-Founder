// src/server/oauth/oauth-service.ts — OAuth 2.1 Authorization Server for the MCP gateway. PRD §10.5.
// Implements authorization-code + PKCE (S256) and Dynamic Client Registration (RFC 7591). The issued
// access token IS an MCP personal-access token (hashed in McpClient), so the gateway's existing bearer
// auth + scopes apply unchanged. Authorization codes are single-use, short-lived, redirect/PKCE-bound.
// Stores are in-memory (codes are ephemeral; clients re-register cheaply) — a Prisma-backed registry can
// drop in later behind the same service.

import { createHash, randomBytes } from "node:crypto";
import type { McpScope } from "../mcp/client-store";

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}

export interface AuthCodeRecord {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  scopes: McpScope[];
  expiresAtMs: number;
}

const ALL_SCOPES: McpScope[] = ["read", "write"];
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Bounds for public Dynamic Client Registration (unauthenticated) — keep the in-memory registry from
// growing without limit and cap per-registration size. Clients re-register cheaply. (RL-001)
const MAX_CLIENTS = 1000;
const MAX_REDIRECT_URIS = 5;
const MAX_CLIENT_NAME_LEN = 120;
const MAX_REDIRECT_URI_LEN = 2048;

const b64url = (buf: Buffer): string => buf.toString("base64url");

/** Verify a PKCE code_verifier against the stored challenge (RFC 7636). */
export function verifyPkce(codeVerifier: string, challenge: string, method: "S256" | "plain"): boolean {
  if (method === "plain") return codeVerifier === challenge;
  return b64url(createHash("sha256").update(codeVerifier).digest()) === challenge;
}

export class OAuthService {
  private readonly clients = new Map<string, OAuthClient>();
  private readonly codes = new Map<string, AuthCodeRecord>();

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  /** Dynamic Client Registration (RFC 7591). Returns the new client. Bounded + capacity-limited. */
  registerClient(input: { clientName?: string; redirectUris: string[] }): OAuthClient {
    const uris = input.redirectUris;
    if (
      uris.length === 0 ||
      uris.length > MAX_REDIRECT_URIS ||
      !uris.every((u) => typeof u === "string" && u.length <= MAX_REDIRECT_URI_LEN && isValidRedirect(u))
    ) {
      throw new OAuthError("invalid_redirect_uri", `redirect_uris harus 1–${MAX_REDIRECT_URIS} URL absolut yang valid.`);
    }
    // At capacity, evict the oldest registration (clients re-register cheaply) so an anonymous caller
    // cannot grow the registry without bound.
    if (this.clients.size >= MAX_CLIENTS) {
      let oldestKey: string | undefined;
      let oldestAt = Infinity;
      for (const [k, c] of this.clients) {
        if (c.createdAt < oldestAt) {
          oldestAt = c.createdAt;
          oldestKey = k;
        }
      }
      if (oldestKey !== undefined) this.clients.delete(oldestKey);
    }
    const client: OAuthClient = {
      clientId: `mcpc_${b64url(randomBytes(16))}`,
      clientName: (input.clientName?.trim() || "MCP Client").slice(0, MAX_CLIENT_NAME_LEN),
      redirectUris: uris,
      createdAt: this.nowMs(),
    };
    this.clients.set(client.clientId, client);
    return client;
  }

  getClient(clientId: string): OAuthClient | null {
    return this.clients.get(clientId) ?? null;
  }

  /** Issue a single-use authorization code bound to PKCE + redirect + scopes. */
  createAuthCode(input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
    scopes?: McpScope[];
  }): string {
    const client = this.clients.get(input.clientId);
    if (client === undefined) throw new OAuthError("invalid_client", "client_id tidak dikenal.");
    if (!client.redirectUris.includes(input.redirectUri)) {
      throw new OAuthError("invalid_request", "redirect_uri tidak terdaftar untuk client ini.");
    }
    if (input.codeChallenge === "") throw new OAuthError("invalid_request", "PKCE code_challenge wajib (OAuth 2.1).");
    // OAuth 2.1 requires S256; refuse the downgradable 'plain' method outright. (VAL-007)
    if (input.codeChallengeMethod !== undefined && input.codeChallengeMethod !== "S256") {
      throw new OAuthError("invalid_request", "code_challenge_method harus S256 (OAuth 2.1).");
    }
    const method = "S256" as const;
    const scopes = (input.scopes ?? ALL_SCOPES).filter((s) => ALL_SCOPES.includes(s));
    const code = `mcpa_${b64url(randomBytes(24))}`;
    this.codes.set(code, {
      code,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: method,
      scopes: scopes.length > 0 ? scopes : ["read"],
      expiresAtMs: this.nowMs() + CODE_TTL_MS,
    });
    return code;
  }

  /** Exchange a code (+PKCE verifier) for the resolved grant. Single-use; throws OAuthError on any mismatch. */
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string; clientId: string }): {
    userId: string;
    scopes: McpScope[];
    clientName: string;
  } {
    const rec = this.codes.get(input.code);
    if (rec === undefined) throw new OAuthError("invalid_grant", "Kode otorisasi tidak valid atau sudah dipakai.");
    this.codes.delete(rec.code); // single-use, even on failure below
    if (this.nowMs() > rec.expiresAtMs) throw new OAuthError("invalid_grant", "Kode otorisasi kedaluwarsa.");
    if (rec.clientId !== input.clientId) throw new OAuthError("invalid_grant", "client_id tidak cocok.");
    if (rec.redirectUri !== input.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri tidak cocok.");
    if (!verifyPkce(input.codeVerifier, rec.codeChallenge, rec.codeChallengeMethod)) {
      throw new OAuthError("invalid_grant", "Verifikasi PKCE gagal.");
    }
    const client = this.clients.get(rec.clientId);
    return { userId: rec.userId, scopes: rec.scopes, clientName: client?.clientName ?? "MCP Client" };
  }
}

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

function isValidRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
