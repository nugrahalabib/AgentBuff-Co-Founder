// /api/mcp — MCP Streamable-HTTP transport (JSON-RPC 2.0). PRD §9.6.2, §10.5.
// Auth: Authorization: Bearer <mcp token>. The token resolves to a user; every tool runs as that user
// (ownership enforced in the registry). POST carries JSON-RPC requests; notifications get 202.
// This is the headless twin of the web UI — same engine, same services.

import { app } from "@/server/runtime";
import { bearerFromHeader } from "@/server/mcp/token";
import { dispatch, RPC } from "@/server/mcp/json-rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json" };

function unauthorized(message: string, req: Request): Response {
  // RFC 9728: point clients at the protected-resource metadata to discover the auth server.
  const origin = new URL(req.url).origin;
  const metadata = `${origin}/.well-known/oauth-protected-resource`;
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...JSON_HEADERS, "WWW-Authenticate": `Bearer realm="agentbuff-mcp", resource_metadata="${metadata}"` },
  });
}

export async function POST(req: Request): Promise<Response> {
  const token = bearerFromHeader(req.headers.get("authorization"));
  if (token === null) return unauthorized("Sertakan header Authorization: Bearer <token MCP>.", req);

  const authed = await app.mcpGateway.authenticate(token);
  if (authed === null) return unauthorized("Token MCP tidak valid atau sudah dicabut.", req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: RPC.PARSE_ERROR, message: "JSON tidak valid." } }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const result = await dispatch(body, {
    registry: app.mcp,
    ctx: app.mcpGateway.context(authed.userId),
    clientId: authed.clientId,
    scopes: authed.scopes,
    audit: app.mcpGateway.audit,
    now: () => new Date().toISOString(),
  });

  // An all-notification batch (or a lone notification) yields no response body. Spec → 202 Accepted.
  if (result === null) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(result), { status: 200, headers: JSON_HEADERS });
}

// This endpoint does not offer a server-initiated SSE stream; per spec, respond 405 to GET.
export function GET(): Response {
  return new Response(JSON.stringify({ error: "Gunakan POST JSON-RPC untuk endpoint MCP ini." }), {
    status: 405,
    headers: { ...JSON_HEADERS, Allow: "POST" },
  });
}
