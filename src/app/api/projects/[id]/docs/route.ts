// POST /api/projects/[id]/docs — generate a proposal or pitch deck (Template-Constrained Generation).
// Slots from the LLM, numbers bound from the deterministic engine. GET lists the project's documents.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import { ProviderError } from "@/lib/ai/registry";
import { DocsInputError } from "@/server/services/docs-service";
import type { DocumentType } from "@/server/domain/types";

async function ownProject(req: Request, id: string): Promise<{ userId: string } | Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });
  const project = await app.repos.projects.get(id);
  if (project === null) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.ownerUserId !== userId) return NextResponse.json({ error: "Project bukan milikmu." }, { status: 403 });
  return { userId };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const { id } = await ctx.params;
  const auth = await ownProject(req, id);
  if (auth instanceof Response) return auth;

  let body: { type?: DocumentType; theme?: string };
  try {
    body = (await req.json()) as { type?: DocumentType; theme?: string };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }
  if (body.type !== "proposal" && body.type !== "pitch_deck") {
    return NextResponse.json({ error: "type harus 'proposal' atau 'pitch_deck'." }, { status: 400 });
  }

  const state = await app.projects.getState(id);
  if (state === null) return NextResponse.json({ error: "State project tidak ditemukan." }, { status: 404 });

  try {
    const doc = await app.docs.generate(auth.userId, { projectState: state, type: body.type, theme: body.theme });
    await app.projects.attachDocument(id, doc.id);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e) {
    if (e instanceof DocsInputError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof ProviderError) {
      return NextResponse.json({ error: "Tautkan API key dulu di Pengaturan.", code: e.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyusun dokumen. Coba lagi sebentar." }, { status: 502 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const auth = await ownProject(req, id);
  if (auth instanceof Response) return auth;
  const docs = await app.repos.documents.list((d) => d.projectId === id);
  return NextResponse.json({ documents: docs });
}
