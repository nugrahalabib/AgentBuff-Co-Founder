// POST /api/byok/codex/status — poll a pending Codex login. On success: validate the session against the
// ChatGPT/Codex backend, then envelope-encrypt the whole token bundle (access + rotating refresh +
// chatgpt-account-id + expiry) and store it as the user's Codex credential. The token never reaches the
// client. PRD §12.16, §13.1. Login required.

import { NextResponse } from "next/server";
import { CodexAdapter } from "@/lib/ai/codex-adapter";
import { serializeBundle } from "@/lib/ai/codex-oauth";
import { consumeCodexLogin, pollCodexLogin } from "@/lib/ai/codex-loopback";
import type { Credential } from "@/lib/ai/types";
import { encryptSecret, fingerprint } from "@/lib/crypto";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation, rateLimit } from "@/server/api-helpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu dengan Google." }, { status: 401 });

  let body: { loginId?: string };
  try {
    body = (await req.json()) as { loginId?: string };
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid." }, { status: 400 });
  }
  const loginId = body.loginId?.trim();
  if (loginId === undefined || loginId === "") {
    return NextResponse.json({ error: "loginId wajib diisi." }, { status: 400 });
  }

  // Poll throttle: the UI polls every 2s; cap to avoid a tight loop hammering the endpoint. (RL-003)
  const limited = await rateLimit(`codex-status:${userId}`, 60, 60_000);
  if (limited !== null) return limited;

  // User-bound: only the account that started this login may poll/consume it (CDX-01).
  const poll = pollCodexLogin(loginId, userId);
  if (poll.status === "pending") return NextResponse.json({ status: "pending" });
  if (poll.status === "error") {
    return NextResponse.json({ status: "error", error: "Login ChatGPT gagal atau dibatalkan. Coba lagi." });
  }

  // Success → consume the one-time bundle, validate it works, then persist (encrypted) for this user.
  const bundle = consumeCodexLogin(loginId, userId);
  if (bundle === null) {
    return NextResponse.json({ status: "error", error: "Sesi login sudah dipakai atau kedaluwarsa." });
  }

  const cred: Credential = {
    provider: "openai_codex",
    type: "oauth_token",
    secret: bundle.accessToken,
    accountId: bundle.chatgptAccountId,
  };
  let capabilities;
  try {
    const result = await new CodexAdapter().validateCredential(cred);
    if (!result.ok) {
      return NextResponse.json({ status: "error", error: result.detail ?? "Sesi Codex ditolak." });
    }
    capabilities = result.capabilities;
  } catch {
    return NextResponse.json({ status: "error", error: "Gagal memvalidasi sesi Codex. Coba lagi sebentar." });
  }

  await app.ensureUser(userId);
  // Become default only if nothing else is currently the default (first credential) or this Codex
  // credential already was — do NOT silently hijack a working Gemini/OpenAI default, since Codex has
  // fewer capabilities (no image-gen/deep-research/vision). The user can switch in Settings. (CDX-03)
  const existing = await app.credentials.listForUser(userId);
  const someoneElseIsDefault = existing.some(
    (c) => c.provider !== "openai_codex" && c.status === "active" && c.isDefault,
  );
  const wasDefault = existing.find((c) => c.provider === "openai_codex")?.isDefault === true;
  await app.credentials.upsert({
    userId,
    provider: "openai_codex",
    credType: "oauth_token",
    ciphertext: await encryptSecret(serializeBundle(bundle), app.master),
    fingerprint: fingerprint(bundle.accessToken),
    capabilities,
    isDefault: wasDefault || !someoneElseIsDefault,
    status: "active",
  });

  return NextResponse.json({
    status: "success",
    capabilities,
    email: bundle.email ?? null,
    plan: bundle.chatgptPlanType ?? null,
  });
}
