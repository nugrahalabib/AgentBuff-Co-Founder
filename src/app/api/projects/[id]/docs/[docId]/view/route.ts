// GET /api/projects/[id]/docs/[docId]/view — serve the rendered, sanitized HTML of a document.
// Print-ready (native @page pagination); the client's "Cetak / Simpan PDF" turns it into a PDF.

import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { renderDocumentHtml } from "@/server/docs/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This standalone HTML is built from LLM-filled (untrusted) slots. Even though templates.ts escapes every
// slot, serve it under its OWN tight CSP so that, if escaping ever regressed, injected markup still cannot
// beacon out (no connect-src), frame, or load remote scripts. Inline style + the print button are allowed.
const DOC_CSP =
  "default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'; font-src 'self' data:; " +
  "script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return new Response("unauthorized", { status: 401 });

  const { id, docId } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null || project.ownerUserId !== userId) return new Response("forbidden", { status: 403 });

  const doc = await app.repos.documents.get(docId);
  if (doc === null || doc.projectId !== id) return new Response("not found", { status: 404 });

  return new Response(renderDocumentHtml(doc), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": DOC_CSP,
    },
  });
}
