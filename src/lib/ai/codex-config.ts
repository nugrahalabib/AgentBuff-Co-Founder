// src/lib/ai/codex-config.ts
// Codex / "Sign in with ChatGPT" OAuth + serving config. PRD §12.16.
//
// ⚠️ These are the PUBLIC OpenAI Codex CLI client values (no client secret — it is a public/native
//    client). Verified against the official codex CLI behaviour + the 9router reference, 2026-06-04.
//    Re-verify against OpenAI docs before production (CLAUDE.md §12.7).
//
// HONEST CONSTRAINT (read before touching the login flow):
//   The Codex OAuth client only whitelists the LOOPBACK redirect `http://localhost:1455/auth/callback`.
//   That means the in-browser callback only works when AgentBuff runs on the SAME machine as the
//   browser (local `pnpm dev`, or a self-hosted single-user instance reached over localhost / an SSH
//   tunnel). A remote, multi-user hosted deployment CANNOT catch that callback on its server — there
//   is no first-party hosted "Sign in with ChatGPT" for this client. See docs/AUTH-SETUP.md.

/** OAuth endpoints + the public Codex CLI client identity. */
export const CODEX_OAUTH = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access",
  /** Fixed loopback redirect — the only redirect_uri this client accepts. */
  redirectUri: "http://localhost:1455/auth/callback",
  loopbackHost: "127.0.0.1",
  loopbackPort: 1455,
  callbackPath: "/auth/callback",
  codeChallengeMethod: "S256" as const,
  /** Extra authorize params the Codex CLI sends (organizations claim + simplified flow). */
  extraAuthorizeParams: {
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "codex_cli_rs",
  } as Record<string, string>,
} as const;

/** Where Codex OAuth tokens are SERVED (the ChatGPT backend — NOT api.openai.com). */
export const CODEX_API_BASE = "https://chatgpt.com/backend-api/codex/responses";

/** Request-time identity headers the ChatGPT/Codex backend expects. */
export const CODEX_ORIGINATOR = "codex_cli_rs";
export const CODEX_USER_AGENT = "codex-cli/1.0.18 (macOS; arm64)";

/**
 * Refresh proactively this long BEFORE expiry. Codex refresh tokens are long-lived but rotate
 * (one-time-use); refreshing 5 days early keeps a valid token well ahead of expiry. (9router parity.)
 */
export const CODEX_REFRESH_LEAD_MS = 5 * 24 * 60 * 60 * 1000;

/** OAuth error codes that mean the refresh-token family is dead → force a fresh re-login. */
export const CODEX_UNRECOVERABLE_ERRORS = new Set([
  "refresh_token_reused",
  "invalid_grant",
  "token_expired",
  "invalid_token",
]);
