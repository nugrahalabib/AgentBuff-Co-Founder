// /api/oauth/authorize — OAuth 2.1 authorization endpoint (code + PKCE) with an explicit consent step.
// PRD §10.5. GET renders a consent page (never auto-issues a code); only a same-origin POST "Setujui"
// mints the code. This defeats the silent-authorization / account-takeover vector (a logged-in victim
// lured to a crafted authorize URL cannot have a token minted without clicking approve on our own page).

import { app } from "@/server/runtime";
import { getServerUserId, isSameOrigin } from "@/server/api-helpers";
import { OAuthError } from "@/server/oauth/oauth-service";
import { escapeHtml } from "@/lib/html/sanitize";
import type { McpScope } from "@/server/mcp/client-store";

export const dynamic = "force-dynamic";

interface AuthzParams {
  clientId: string;
  redirectUri: string;
  responseType: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string;
  scope: string;
  state: string | null;
}

function readParams(get: (k: string) => string | null): AuthzParams {
  return {
    clientId: get("client_id") ?? "",
    redirectUri: get("redirect_uri") ?? "",
    responseType: get("response_type"),
    codeChallenge: get("code_challenge"),
    codeChallengeMethod: get("code_challenge_method") ?? "S256",
    scope: get("scope") ?? "read",
    state: get("state"),
  };
}

function parseScopes(scope: string): McpScope[] {
  const s = scope.split(/\s+/).filter((x): x is McpScope => x === "read" || x === "write");
  return s.length > 0 ? s : ["read"];
}

function errRedirect(redirectUri: string, error: string, state: string | null): Response {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (state !== null) u.searchParams.set("state", state);
  return Response.redirect(u.toString(), 302);
}

/** Validate the client + request; returns the client name or a Response to short-circuit. */
async function validate(p: AuthzParams): Promise<{ clientName: string } | Response> {
  if (p.clientId === "" || p.redirectUri === "") return new Response("client_id dan redirect_uri wajib.", { status: 400 });
  const client = app.oauth.getClient(p.clientId);
  if (client === null || !client.redirectUris.includes(p.redirectUri)) {
    return new Response("client_id/redirect_uri tidak valid.", { status: 400 });
  }
  if (p.responseType !== "code") return errRedirect(p.redirectUri, "unsupported_response_type", p.state);
  if (p.codeChallenge === null) return errRedirect(p.redirectUri, "invalid_request", p.state); // PKCE required
  return { clientName: client.clientName };
}

// --- GET: show the consent page (no code issued here) ---
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = readParams((k) => url.searchParams.get(k));
  const v = await validate(p);
  if (v instanceof Response) return v;

  const userId = await getServerUserId();
  if (userId === null) {
    const signin = new URL("/api/auth/signin", url.origin);
    signin.searchParams.set("callbackUrl", req.url);
    return Response.redirect(signin.toString(), 302);
  }

  const scopes = parseScopes(p.scope);
  const hidden = (name: string, value: string) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
  const scopeText = scopes.includes("write") ? "membaca DAN mengubah" : "membaca";
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Izinkan akses?</title><style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6fb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#1e1b2e}
  .card{background:#fff;max-width:420px;width:92%;border:1px solid #e5e7eb;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  h1{font-size:20px;margin:0 0 8px}.muted{color:#666;font-size:14px;line-height:1.5}
  .scopes{background:#f8fafc;border:1px solid #eef;border-radius:10px;padding:12px;margin:16px 0;font-size:14px}
  .row{display:flex;gap:10px;margin-top:18px}button,a.btn{flex:1;text-align:center;border-radius:999px;padding:11px;font-weight:600;font-size:14px;cursor:pointer;text-decoration:none;border:0}
  .ok{background:#6366F1;color:#fff}.no{background:#fff;color:#444;border:1px solid #e5e7eb}
</style></head><body>
  <div class="card">
    <h1>Izinkan <strong>${escapeHtml(v.clientName)}</strong>?</h1>
    <p class="muted">Aplikasi ini meminta akses ke akun AgentBuff Co-Founder kamu lewat Agent Gateway (MCP).</p>
    <div class="scopes">Akan bisa <strong>${escapeHtml(scopeText)}</strong> project, riset, plan, brand, dan dokumen milikmu.</div>
    <form method="POST" action="/api/oauth/authorize">
      ${hidden("client_id", p.clientId)}${hidden("redirect_uri", p.redirectUri)}${hidden("response_type", "code")}
      ${hidden("code_challenge", p.codeChallenge ?? "")}${hidden("code_challenge_method", p.codeChallengeMethod)}
      ${hidden("scope", scopes.join(" "))}${p.state !== null ? hidden("state", p.state) : ""}
      <div class="row">
        <a class="btn no" href="${escapeHtml(errRedirectUrl(p.redirectUri, "access_denied", p.state))}">Batalkan</a>
        <button class="ok" type="submit">Setujui</button>
      </div>
    </form>
    <p class="muted" style="margin-top:14px;font-size:12px">Hanya setujui aplikasi yang kamu percaya. Token bisa dicabut kapan saja di Pengaturan.</p>
  </div>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function errRedirectUrl(redirectUri: string, error: string, state: string | null): string {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (state !== null) u.searchParams.set("state", state);
  return u.toString();
}

// --- POST: explicit approval → issue the code (same-origin only) ---
export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return new Response("forbidden", { status: 403 });
  const form = await req.formData();
  const p = readParams((k) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  });
  const v = await validate(p);
  if (v instanceof Response) return v;

  const userId = await getServerUserId();
  if (userId === null) return new Response("unauthorized", { status: 401 });

  try {
    const code = app.oauth.createAuthCode({
      clientId: p.clientId,
      userId,
      redirectUri: p.redirectUri,
      codeChallenge: p.codeChallenge!,
      codeChallengeMethod: p.codeChallengeMethod,
      scopes: parseScopes(p.scope),
    });
    const out = new URL(p.redirectUri);
    out.searchParams.set("code", code);
    if (p.state !== null) out.searchParams.set("state", p.state);
    return Response.redirect(out.toString(), 302);
  } catch (e) {
    return errRedirect(p.redirectUri, e instanceof OAuthError ? e.code : "server_error", p.state);
  }
}
