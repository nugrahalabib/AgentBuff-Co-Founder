// /api/onboarding/profile — save the user's business profile (data diri). PRD §9.1.5.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";

interface ProfileBody {
  displayName?: string;
  sector?: string;
  stage?: string;
  primaryGoal?: string;
  budgetBand?: string;
}

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu untuk menyimpan profil." }, { status: 401 });

  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }

  await app.ensureUser(userId);
  await app.saveProfile(userId, body);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ profile: null });
  return NextResponse.json({ profile: await app.getProfile(userId) });
}
