// POST /api/projects/[id]/validate — run grounded Deep Research & Validator with the user's BYOK key.
// LLM proposes grounded signals; the deterministic engine computes the score. PRD §9.2.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { ProviderError } from "@/lib/ai/registry";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });

  const { id } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.ownerUserId !== userId) return NextResponse.json({ error: "Project bukan milikmu." }, { status: 403 });

  let market: string | undefined;
  try {
    market = ((await req.json()) as { market?: string }).market;
  } catch {
    market = undefined;
  }

  try {
    const report = await app.research.validateIdea(userId, { projectId: project.id, ideaText: project.ideaText, market });
    await app.projects.attachResearch(project.id, report.id);
    return NextResponse.json({ report });
  } catch (e) {
    if (e instanceof ProviderError) {
      return NextResponse.json({ error: "Tautkan API key dulu di Onboarding.", code: e.code }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Gagal menjalankan validasi.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
