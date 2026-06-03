// POST /api/byok/validate — validate a BYOK key against the provider (liveness + capability detection).
// PRD §9.1.4. The key is used in-memory ONLY and is NOT stored or logged here (storage = encrypt + DB,
// a separate authenticated flow). Returns { ok, capabilities, detail }.

import { NextResponse } from "next/server";
import { GeminiAdapter } from "@/lib/ai/gemini-adapter";
import { OpenAIAdapter } from "@/lib/ai/openai-adapter";
import type { Credential } from "@/lib/ai/types";

const adapters = {
  gemini: () => new GeminiAdapter(),
  openai: () => new OpenAIAdapter(),
} as const;

type ValidatableProvider = keyof typeof adapters;

export async function POST(req: Request): Promise<Response> {
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Validasi gagal.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
