// GET /api/account/export — UU PDP right to access: download everything we hold about you (no secrets).

import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return new Response(JSON.stringify({ error: "Masuk dulu." }), { status: 401 });

  const data = await app.account.export(userId);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agentbuff-data-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
