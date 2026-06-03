// POST /api/projects/[id]/plan — generate the business plan: numbers from the deterministic engine,
// narrative from the user's BYOK provider (numbers injected, not regenerated). PRD §9.3.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { ProviderError } from "@/lib/ai/registry";
import { FinancialInputError, type FinancialInputs } from "@/server/engine/financial/index";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });

  const { id } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.ownerUserId !== userId) return NextResponse.json({ error: "Project bukan milikmu." }, { status: 403 });

  let body: { financial_inputs?: FinancialInputs };
  try {
    body = (await req.json()) as { financial_inputs?: FinancialInputs };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }
  if (body.financial_inputs === undefined) {
    return NextResponse.json({ error: "financial_inputs wajib diisi." }, { status: 400 });
  }

  try {
    const state = await app.projects.getState(project.id);
    const plan = await app.planner.generatePlan(userId, {
      projectId: project.id,
      inputs: body.financial_inputs,
      researchSummary: state?.research?.summary,
    });
    await app.projects.attachPlan(project.id, plan.id);
    return NextResponse.json({ plan });
  } catch (e) {
    if (e instanceof FinancialInputError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof ProviderError) {
      return NextResponse.json({ error: "Tautkan API key dulu di Onboarding.", code: e.code }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Gagal menyusun plan.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
