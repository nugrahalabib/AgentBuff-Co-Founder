// GET /api/account/usage — BYOK usage summary for the signed-in user (cost/quota awareness). PRD §16.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";
import { NO_STORE } from "@/server/http-guards";
import { emptySummary } from "@/server/services/usage-recorder";

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json(emptySummary(), { headers: NO_STORE });
  return NextResponse.json(await app.usage.summary(userId), { headers: NO_STORE });
}
