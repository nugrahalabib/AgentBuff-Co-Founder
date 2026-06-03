// GET /api/oauth/authorize — OAuth 2.1 authorization endpoint (code + PKCE). PRD §10.5.
// Requires the user to be logged in (the agent is connecting on their behalf); if not, bounce to sign-in
// and come back. On success, issues a single-use code and redirects to the client's redirect_uri.

import { app } from "@/server/runtime";
import { getServerUserId } from "@/server/api-helpers";
import { OAuthError } from "@/server/oauth/oauth-service";
import type { McpScope } from "@/server/mcp/client-store";

export const dynamic = "force-dynamic";

function errRedirect(redirectUri: string, error: string, state: string | null): Response {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (state !== null) u.searchParams.set("state", state);
  return Response.redirect(u.toString(), 302);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams;
  const clientId = q.get("client_id");
  const redirectUri = q.get("redirect_uri");
  const responseType = q.get("response_type");
  const codeChallenge = q.get("code_challenge");
  const state = q.get("state");

  if (clientId === null || redirectUri === null) {
    return new Response("client_id dan redirect_uri wajib.", { status: 400 });
  }
  const client = app.oauth.getClient(clientId);
  if (client === null || !client.redirectUris.includes(redirectUri)) {
    return new Response("client_id/redirect_uri tidak valid.", { status: 400 });
  }
  if (responseType !== "code") return errRedirect(redirectUri, "unsupported_response_type", state);
  if (codeChallenge === null) return errRedirect(redirectUri, "invalid_request", state); // PKCE required (OAuth 2.1)

  // The user must be authenticated; if not, send them to sign in and return here.
  const userId = await getServerUserId();
  if (userId === null) {
    const signin = new URL("/api/auth/signin", url.origin);
    signin.searchParams.set("callbackUrl", req.url);
    return Response.redirect(signin.toString(), 302);
  }

  const scopes = (q.get("scope") ?? "read write").split(/\s+/).filter((s): s is McpScope => s === "read" || s === "write");
  try {
    const code = app.oauth.createAuthCode({
      clientId,
      userId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: q.get("code_challenge_method") ?? "S256",
      scopes,
    });
    const out = new URL(redirectUri);
    out.searchParams.set("code", code);
    if (state !== null) out.searchParams.set("state", state);
    return Response.redirect(out.toString(), 302);
  } catch (e) {
    return errRedirect(redirectUri, e instanceof OAuthError ? e.code : "server_error", state);
  }
}
