// GET /api/projects/[id]/docs/[docId]/pdf — server-rendered PDF via headless Chromium. PRD §9.5.
// Renders the SAME sanitized HTML the browser prints (CSS @page drives A4 / 16:9). Falls back to 503 with
// a friendly hint where Chromium isn't installed — the in-browser "Cetak / Simpan PDF" path always works.

import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { renderDocumentHtml } from "@/server/docs/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return new Response("unauthorized", { status: 401 });

  const { id, docId } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null || project.ownerUserId !== userId) return new Response("forbidden", { status: 403 });

  const doc = await app.repos.documents.get(docId);
  if (doc === null || doc.projectId !== id) return new Response("not found", { status: 404 });

  if (!(await app.pdf.available())) {
    return new Response(
      JSON.stringify({ error: "Render PDF server belum tersedia. Gunakan 'Buka & Cetak' lalu Simpan sebagai PDF." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const pdf = await app.pdf.render(renderDocumentHtml(doc));
    const safeName = doc.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Gagal merender PDF. Coba lagi sebentar." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
