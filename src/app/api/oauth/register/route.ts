// POST /api/oauth/register — OAuth 2.1 Dynamic Client Registration (RFC 7591). PRD §10.5.
// Public registration (public clients with PKCE, no client secret). Returns a client_id.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { OAuthError } from "@/server/oauth/oauth-service";
import { clientIp, enforceBodyLimit, rateLimit } from "@/server/http-guards";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // Public (unauthenticated) DCR endpoint — the most exposed mutating route. Throttle per-IP + cap body
  // size so an anonymous caller can't flood the in-memory client registry. (RL-001, DOS-005)
  const tooBig = enforceBodyLimit(req, 16 * 1024);
  if (tooBig !== null) return tooBig;
  const limited = await rateLimit(`oauth-register:${clientIp(req)}`, 20, 60_000);
  if (limited !== null) return limited;

  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = (await req.json()) as { redirect_uris?: unknown; client_name?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  try {
    const client = app.oauth.registerClient({
      redirectUris,
      clientName: typeof body.client_name === "string" ? body.client_name : undefined,
    });
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof OAuthError) return NextResponse.json({ error: e.code, error_description: e.message }, { status: 400 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
