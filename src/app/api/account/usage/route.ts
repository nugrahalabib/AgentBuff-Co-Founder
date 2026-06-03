// GET /api/account/usage — BYOK usage summary for the signed-in user (cost/quota awareness). PRD §16.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { emptySummary } from "@/server/services/usage-recorder";

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json(emptySummary());
  return NextResponse.json(await app.usage.summary(userId));
}
