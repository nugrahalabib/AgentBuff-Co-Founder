// POST /api/projects/[id]/validate/stream — run the Deep Research pipeline and stream per-stage
// progress as Server-Sent Events, then the final report. Powers the meaningful stepper (§9.2.9).
// Same engine as the non-streaming route; numbers stay deterministic, citations grounded.

import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import { ProviderError } from "@/lib/ai/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return new Response("unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null) return new Response("not found", { status: 404 });
  if (project.ownerUserId !== userId) return new Response("forbidden", { status: 403 });

  let market: string | undefined;
  try {
    market = ((await req.json()) as { market?: string }).market;
  } catch {
    market = undefined;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const report = await app.research.validateIdea(userId, {
          projectId: project.id,
          ideaText: project.ideaText,
          market,
          onStage: (p) => send("stage", p),
        });
        await app.projects.attachResearch(project.id, report.id);
        send("done", { report });
      } catch (e) {
        if (e instanceof ProviderError) {
          send("error", { error: "Tautkan API key dulu di Pengaturan.", code: e.code });
        } else {
          send("error", { error: e instanceof Error ? e.message : "Gagal menjalankan validasi." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
