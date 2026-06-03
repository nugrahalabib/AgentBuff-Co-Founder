// /api/mcp/tokens — manage the user's MCP access tokens (Agent Gateway). PRD §9.6.5.
//   GET                              → list clients (no secrets)
//   POST { action:"create", name }   → issue a token (plaintext returned ONCE)
//   POST { action:"revoke", id }     → revoke a token
// Cookie/session authenticated + same-origin guarded (these are browser-driven management calls).

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ clients: [] });
  return NextResponse.json({ clients: await app.mcpGateway.listClients(userId) });
}

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;

  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu untuk mengelola token MCP." }, { status: 401 });

  let body: { action?: string; name?: string; id?: string; readOnly?: boolean };
  try {
    body = (await req.json()) as { action?: string; name?: string; id?: string; readOnly?: boolean };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }

  if (body.action === "create") {
    await app.ensureUser(userId);
    const scopes = body.readOnly === true ? (["read"] as const) : (["read", "write"] as const);
    const issued = await app.mcpGateway.issueToken(userId, body.name ?? "Token MCP", [...scopes]);
    // `token` is returned exactly once; it is never stored in plaintext nor retrievable later.
    return NextResponse.json({
      token: issued.token,
      display: issued.display,
      id: issued.id,
      clients: await app.mcpGateway.listClients(userId),
    });
  }

  if (body.action === "revoke") {
    if (typeof body.id !== "string" || body.id === "") {
      return NextResponse.json({ error: "id token wajib." }, { status: 400 });
    }
    const ok = await app.mcpGateway.revoke(userId, body.id);
    if (!ok) return NextResponse.json({ error: "Token tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ clients: await app.mcpGateway.listClients(userId) });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
