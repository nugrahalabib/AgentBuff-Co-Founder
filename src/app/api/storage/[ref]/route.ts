// GET /api/storage/[ref] — serve a stored object (brand images, rendered docs). PRD §10.2.
// Backed by the ObjectStorage seam; the in-memory impl serves from process memory, the S3 impl would
// redirect to an expiring URL. Public-by-ref (refs are unguessable keys); no listing.

import { app } from "@/server/runtime";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }): Promise<Response> {
  const { ref } = await ctx.params;
  const obj = await app.storage.get(decodeURIComponent(ref));
  if (obj === null) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(obj.data), {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=3600" },
  });
}
