// POST /api/projects/[id]/brand — generate a Brand Kit (direction from LLM, palette from the engine).
// Image assets are attempted only when the user's provider supports image generation (capability-gated).

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import { ProviderError } from "@/lib/ai/registry";
import { BrandInputError } from "@/server/services/brand-service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });

  const { id } = await ctx.params;
  const project = await app.repos.projects.get(id);
  if (project === null) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.ownerUserId !== userId) return NextResponse.json({ error: "Project bukan milikmu." }, { status: 403 });

  let withImages = true;
  try {
    const body = (await req.json()) as { withImages?: boolean };
    if (body.withImages === false) withImages = false;
  } catch {
    /* default */
  }

  const state = await app.projects.getState(id);
  if (state === null) return NextResponse.json({ error: "State project tidak ditemukan." }, { status: 404 });

  try {
    const kit = await app.brand.generate(userId, { projectState: state, withImages });
    await app.projects.attachBrandKit(id, kit.id);
    return NextResponse.json({ brandKit: kit }, { status: 201 });
  } catch (e) {
    if (e instanceof BrandInputError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof ProviderError) {
      return NextResponse.json({ error: "Tautkan API key dulu di Pengaturan.", code: e.code }, { status: 400 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal menyusun brand." }, { status: 502 });
  }
}
