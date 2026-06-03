// GET /api/byok/status — non-secret summary of the user's linked BYOK credentials. PRD §9.1.4-6.
// Returns liveness + capabilities + which provider is default; never any secret material.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId } from "@/server/api-helpers";

export async function GET(req: Request): Promise<Response> {
  const userId = await currentUserId(req);
  if (userId === null) {
    return NextResponse.json({ hasActive: false, defaultProvider: null, credentials: [] });
  }
  const summary = await app.credentialService.summary(userId);
  return NextResponse.json(summary);
}
