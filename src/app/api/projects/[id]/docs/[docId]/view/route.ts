// GET /api/projects/[id]/docs/[docId]/view — serve the rendered, sanitized HTML of a document.
// Print-ready (native @page pagination); the client's "Cetak / Simpan PDF" turns it into a PDF.

import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { renderDocumentHtml } from "@/server/docs/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return new Response("unauthorized", { status: 401 });

  const { id, docId } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null || project.ownerUserId !== userId) return new Response("forbidden", { status: 403 });

  const doc = await app.repos.documents.get(docId);
  if (doc === null || doc.projectId !== id) return new Response("not found", { status: 404 });

  return new Response(renderDocumentHtml(doc), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
