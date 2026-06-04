// POST /api/byok/link — validate a BYOK key AND link it to the signed-in user, encrypted. PRD §9.1.4, §13.1.
// The plaintext key is used in-memory only; only the envelope ciphertext + fingerprint are stored. Login required.

import { NextResponse } from "next/server";
import { GeminiAdapter } from "@/lib/ai/gemini-adapter";
import { OpenAIAdapter } from "@/lib/ai/openai-adapter";
import type { Credential } from "@/lib/ai/types";
import { encryptSecret, fingerprint } from "@/lib/crypto";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";

const adapters = {
  gemini: () => new GeminiAdapter(),
  openai: () => new OpenAIAdapter(),
  // Codex (Sign in with ChatGPT) speaks the OpenAI Responses surface; auth is an OAuth token. PRD §12.16.
  openai_codex: () => new OpenAIAdapter(),
} as const;
type ValidatableProvider = keyof typeof adapters;

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu dengan Google." }, { status: 401 });

  let body: { provider?: string; apiKey?: string };
  try {
    body = (await req.json()) as { provider?: string; apiKey?: string };
  } catch {
    return NextResponse.json({ error: "Body permintaan bukan JSON yang valid." }, { status: 400 });
  }

  const provider = body.provider;
  const apiKey = body.apiKey?.trim();
  if (
    apiKey === undefined ||
    apiKey === "" ||
    (provider !== "gemini" && provider !== "openai" && provider !== "openai_codex")
  ) {
    return NextResponse.json({ error: "Pilih provider (Gemini / OpenAI / Codex) dan masukkan API key atau token." }, { status: 400 });
  }

  const credType = provider === "openai_codex" ? "oauth_token" : "api_key";
  const cred: Credential = { provider: provider as ValidatableProvider, type: credType, secret: apiKey };
  let result;
  try {
    result = await adapters[provider as ValidatableProvider]().validateCredential(cred);
  } catch {
    // Generic message to the client (never echo raw adapter/provider text). §13.1 defense-in-depth.
    return NextResponse.json({ ok: false, error: "Gagal memvalidasi kredensial. Coba lagi sebentar." }, { status: 502 });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.detail ?? "Kredensial ditolak." });
  }

  await app.ensureUser(userId);
  await app.credentials.upsert({
    userId,
    provider: provider as ValidatableProvider,
    credType,
    ciphertext: encryptSecret(apiKey, app.master),
    fingerprint: fingerprint(apiKey),
    capabilities: result.capabilities,
    isDefault: true,
    status: "active",
  });

  return NextResponse.json({ ok: true, capabilities: result.capabilities });
}
