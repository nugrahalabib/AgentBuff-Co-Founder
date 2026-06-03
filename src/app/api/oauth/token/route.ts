// POST /api/oauth/token — OAuth 2.1 token endpoint. PRD §10.5.
// Exchanges an authorization code (+PKCE verifier) for an access token. The access token IS an MCP
// personal-access token (hashed in McpClient), so the gateway's bearer auth + scopes apply unchanged.
// Accepts application/x-www-form-urlencoded (standard) or JSON.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { OAuthError } from "@/server/oauth/oauth-service";

export const dynamic = "force-dynamic";

async function readParams(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export async function POST(req: Request): Promise<Response> {
  let p: Record<string, string>;
  try {
    p = await readParams(req);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (p["grant_type"] !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }
  const { code, code_verifier: codeVerifier, redirect_uri: redirectUri, client_id: clientId } = p;
  if (!code || !codeVerifier || !redirectUri || !clientId) {
    return NextResponse.json({ error: "invalid_request", error_description: "code, code_verifier, redirect_uri, client_id wajib." }, { status: 400 });
  }

  try {
    const grant = app.oauth.exchangeCode({ code, codeVerifier, redirectUri, clientId });
    await app.ensureUser(grant.userId);
    const issued = await app.mcpGateway.issueToken(grant.userId, grant.clientName, grant.scopes);
    return NextResponse.json(
      { access_token: issued.token, token_type: "Bearer", scope: issued.scopes.join(" ") },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof OAuthError) return NextResponse.json({ error: e.code, error_description: e.message }, { status: 400 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
