// GET /api/storage/[ref] — serve a stored object (brand images). PRD §10.2, §13.4.
// Access-controlled (NOT just unguessable refs): requires a session, and enforces that the object's
// recorded owner matches the caller (defense-in-depth against a future predictable-key migration).

import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ ref: string }> }): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return new Response("unauthorized", { status: 401 });

  const { ref } = await ctx.params;
  const obj = await app.storage.get(decodeURIComponent(ref));
  if (obj === null) return new Response("not found", { status: 404 });
  // Fail closed: serve ONLY when the recorded owner matches the caller. An object with no owner is
  // never served (defense-in-depth against a future producer that forgets to stamp the owner). (BYOK-04)
  if (obj.ownerUserId !== userId) {
    return new Response("forbidden", { status: 403 });
  }
  return new Response(new Uint8Array(obj.data), {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=3600" },
  });
}
