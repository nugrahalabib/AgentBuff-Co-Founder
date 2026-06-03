// GET /.well-known/oauth-protected-resource — Protected Resource Metadata (RFC 9728). PRD §10.5.
// Points MCP clients from the resource (/api/mcp) to the authorization server.

export const dynamic = "force-dynamic";

function origin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function GET(req: Request): Response {
  const base = origin(req);
  return Response.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ["read", "write"],
    bearer_methods_supported: ["header"],
  });
}
