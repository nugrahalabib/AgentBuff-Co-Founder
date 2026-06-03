// POST /api/byok/manage — manage linked BYOK credentials (no secrets in/out). PRD §9.1.4-6, §13.1.
//   { action: "revalidate" }                  → re-probe all keys, refresh status/capabilities
//   { action: "default",  provider }          → set the default provider
//   { action: "remove",   provider }          → unlink a provider's credential
// Returns the refreshed credential summary. Same-origin guarded (CSRF). Login/guest session required.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import type { ProviderId } from "@/lib/ai/types";

const PROVIDERS: ProviderId[] = ["gemini", "openai", "openai_codex"];

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;

  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });

  let body: { action?: string; provider?: string };
  try {
    body = (await req.json()) as { action?: string; provider?: string };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }

  const provider = body.provider as ProviderId | undefined;
  const needsProvider = body.action === "default" || body.action === "remove";
  if (needsProvider && (provider === undefined || !PROVIDERS.includes(provider))) {
    return NextResponse.json({ error: "Provider tidak dikenal." }, { status: 400 });
  }

  switch (body.action) {
    case "revalidate": {
      const summary = await app.credentialService.revalidate(userId);
      return NextResponse.json(summary);
    }
    case "default": {
      const ok = await app.credentialService.setDefault(userId, provider!);
      if (!ok) return NextResponse.json({ error: "Kredensial tidak ditemukan." }, { status: 404 });
      return NextResponse.json(await app.credentialService.summary(userId));
    }
    case "remove": {
      const ok = await app.credentialService.remove(userId, provider!);
      if (!ok) return NextResponse.json({ error: "Kredensial tidak ditemukan." }, { status: 404 });
      return NextResponse.json(await app.credentialService.summary(userId));
    }
    default:
      return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
  }
}
