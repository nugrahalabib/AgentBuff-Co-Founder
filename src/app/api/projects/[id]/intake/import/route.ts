// POST /api/projects/[id]/intake/import — pre-fill the financial intake from an uploaded document.
// PRD §9.3.4.1. Document Understanding extracts figures; the user reviews/edits before the engine computes
// (human-in-the-loop — numbers stay deterministic). Accepts { fileDataUrl: "data:application/pdf;base64,..." }.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import { ProviderError } from "@/lib/ai/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });

  const { id } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.ownerUserId !== userId) return NextResponse.json({ error: "Project bukan milikmu." }, { status: 403 });

  let fileDataUrl: string | undefined;
  try {
    fileDataUrl = ((await req.json()) as { fileDataUrl?: string }).fileDataUrl;
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }
  if (typeof fileDataUrl !== "string" || !fileDataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "Unggah dokumen sebagai data URL (PDF/gambar)." }, { status: 400 });
  }

  try {
    const intake = await app.planner.importIntake(userId, fileDataUrl);
    return NextResponse.json({ intake });
  } catch (e) {
    if (e instanceof ProviderError) {
      return NextResponse.json({ error: "Tautkan API key dulu di Pengaturan.", code: e.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal membaca dokumen. Coba lagi sebentar." }, { status: 502 });
  }
}
