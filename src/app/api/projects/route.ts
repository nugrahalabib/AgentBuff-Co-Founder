// /api/projects — create (POST) and list (GET) the session user's projects. PRD §9.1.5, §8.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { sessionUser, currentUserId, withSession } from "@/server/api-helpers";

export async function POST(req: Request): Promise<Response> {
  const s = sessionUser(req);
  let body: { idea?: string; sector?: string; geography?: string };
  try {
    body = (await req.json()) as { idea?: string; sector?: string; geography?: string };
  } catch {
    return withSession({ error: "Body permintaan bukan JSON yang valid." }, s, { status: 400 });
  }
  const idea = body.idea?.trim();
  if (idea === undefined || idea === "") {
    return withSession({ error: "Ceritakan ide bisnismu dulu." }, s, { status: 400 });
  }
  const project = await app.projects.create({
    ownerUserId: s.userId,
    ideaText: idea,
    sector: body.sector,
    geography: body.geography,
  });
  return withSession({ project }, s, { status: 201 });
}

export async function GET(req: Request): Promise<Response> {
  const userId = currentUserId(req);
  if (userId === null) return NextResponse.json({ projects: [] });
  return NextResponse.json({ projects: await app.projects.listForUser(userId) });
}
