// POST /api/byok/validate — validate a BYOK key against the provider (liveness + capability detection).
// PRD §9.1.4. The key is used in-memory ONLY and is NOT stored or logged here (storage = encrypt + DB,
// a separate authenticated flow). Returns { ok, capabilities, detail }.

import { NextResponse } from "next/server";
import { GeminiAdapter } from "@/lib/ai/gemini-adapter";
import { OpenAIAdapter } from "@/lib/ai/openai-adapter";
import type { Credential } from "@/lib/ai/types";
import { currentUserId, guardMutation, rateLimit } from "@/server/api-helpers";

const adapters = {
  gemini: () => new GeminiAdapter(),
  openai: () => new OpenAIAdapter(),
} as const;

type ValidatableProvider = keyof typeof adapters;

export async function POST(req: Request): Promise<Response> {
  // Auth + CSRF + throttle: don't be an open key-validation oracle for arbitrary keys. (BYOK-01, RL-003)
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu dengan Google." }, { status: 401 });
  const limited = await rateLimit(`byok-validate:${userId}`, 10, 60_000);
  if (limited !== null) return limited;

  let body: { provider?: string; apiKey?: string };
  try {
    body = (await req.json()) as { provider?: string; apiKey?: string };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }

  const provider = body.provider;
  const apiKey = body.apiKey?.trim();
  if (apiKey === undefined || apiKey === "" || (provider !== "gemini" && provider !== "openai")) {
    return NextResponse.json({ error: "Pilih provider (gemini/openai) dan masukkan API key." }, { status: 400 });
  }

  const adapter = adapters[provider as ValidatableProvider]();
  const cred: Credential = { provider: provider as ValidatableProvider, type: "api_key", secret: apiKey };

  try {
    const result = await adapter.validateCredential(cred);
    return NextResponse.json({ ok: result.ok, capabilities: result.capabilities, detail: result.detail });
  } catch {
    // Generic message to the client (never echo raw adapter/provider text). §13.1 defense-in-depth.
    return NextResponse.json({ ok: false, error: "Gagal memvalidasi kredensial. Coba lagi sebentar." }, { status: 502 });
  }
}
