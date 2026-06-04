// POST /api/byok/codex/start — begin Codex "Sign in with ChatGPT" via the local loopback flow. §12.16.
// Binds a localhost:1455 listener (works only when the app runs on the user's own machine) and returns
// the authorize URL + a loginId the client polls. Login required; never returns any token to the client.

import { NextResponse } from "next/server";
import { startCodexLogin } from "@/lib/ai/codex-loopback";
import { currentUserId, guardMutation } from "@/server/api-helpers";

export const runtime = "nodejs"; // needs node:http to bind the loopback listener (not edge)

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu dengan Google." }, { status: 401 });

  try {
    const { loginId, authorizeUrl } = await startCodexLogin();
    return NextResponse.json({ ok: true, loginId, authorizeUrl });
  } catch (e) {
    // Most common cause on a remote/hosted deploy: the loopback port can't be bound here. Be honest.
    const detail = e instanceof Error ? e.message : "Gagal memulai login Codex.";
    return NextResponse.json(
      {
        ok: false,
        error: detail,
        hint: "Login ChatGPT (Codex) hanya bisa saat AgentBuff berjalan di komputermu sendiri (mode lokal/self-host).",
      },
      { status: 503 },
    );
  }
}
