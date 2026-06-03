// POST /api/byok/link — validate a BYOK key AND link it to the (guest) session, encrypted. PRD §9.1.4, §13.1.
// The plaintext key is used in-memory only; only the envelope ciphertext + fingerprint are stored.

import { GeminiAdapter } from "@/lib/ai/gemini-adapter";
import { OpenAIAdapter } from "@/lib/ai/openai-adapter";
import type { Credential } from "@/lib/ai/types";
import { encryptSecret, fingerprint } from "@/lib/crypto";
import { app } from "@/server/runtime";
import { resolveSessionUser, withSession, guardMutation } from "@/server/api-helpers";

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
  const s = await resolveSessionUser(req);

  let body: { provider?: string; apiKey?: string };
  try {
    body = (await req.json()) as { provider?: string; apiKey?: string };
  } catch {
    return withSession({ error: "Body permintaan bukan JSON yang valid." }, s, { status: 400 });
  }

  const provider = body.provider;
  const apiKey = body.apiKey?.trim();
  if (
    apiKey === undefined ||
    apiKey === "" ||
    (provider !== "gemini" && provider !== "openai" && provider !== "openai_codex")
  ) {
    return withSession({ error: "Pilih provider (Gemini / OpenAI / Codex) dan masukkan API key atau token." }, s, { status: 400 });
  }

  const credType = provider === "openai_codex" ? "oauth_token" : "api_key";
  const cred: Credential = { provider: provider as ValidatableProvider, type: credType, secret: apiKey };
  let result;
  try {
    result = await adapters[provider as ValidatableProvider]().validateCredential(cred);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Validasi gagal.";
    return withSession({ ok: false, error: message }, s, { status: 502 });
  }

  if (!result.ok) {
    return withSession({ ok: false, error: result.detail ?? "Kredensial ditolak." }, s);
  }

  await app.ensureUser(s.userId);
  await app.credentials.upsert({
    userId: s.userId,
    provider: provider as ValidatableProvider,
    credType,
    ciphertext: encryptSecret(apiKey, app.master),
    fingerprint: fingerprint(apiKey),
    capabilities: result.capabilities,
    isDefault: true,
    status: "active",
  });

  return withSession({ ok: true, capabilities: result.capabilities }, s);
}
