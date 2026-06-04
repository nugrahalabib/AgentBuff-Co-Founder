// /api/projects — create (POST) and list (GET) the session user's projects. PRD §9.1.5, §8.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import { NO_STORE } from "@/server/http-guards";

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu dengan Google." }, { status: 401 });

  let body: { idea?: string; sector?: string; geography?: string };
  try {
    body = (await req.json()) as { idea?: string; sector?: string; geography?: string };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }
  const idea = body.idea?.trim();
  if (idea === undefined || idea === "") {
    return NextResponse.json({ error: "Ceritakan ide bisnismu dulu." }, { status: 400 });
  }
  await app.ensureUser(userId);
  const project = await app.projects.create({
    ownerUserId: userId,
    ideaText: idea,
    sector: body.sector,
    geography: body.geography,
  });
  return NextResponse.json({ project }, { status: 201 });
}

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ projects: [] }, { headers: NO_STORE });
  return NextResponse.json({ projects: await app.projects.listForUser(userId) }, { headers: NO_STORE });
}
