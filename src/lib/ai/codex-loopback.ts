// src/lib/ai/codex-loopback.ts
// SERVER-ONLY. Catches the Codex OAuth loopback callback on http://127.0.0.1:1455/auth/callback,
// exchanges the code for a token bundle, and holds it transiently in memory (keyed by `state`) until
// the authenticated /api/byok/codex/status route consumes it and persists it under the user.
//
// This only works when AgentBuff runs on the SAME machine as the browser (local dev / self-host single
// user). On a serverless/remote host the port bind fails — we surface a friendly, honest error so the
// UI can fall back. The token bundle never touches the client; the loopback handler has no user session.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { CODEX_OAUTH } from "./codex-config";
import { buildAuthorizeUrl, exchangeCode, generatePkce, generateState, type CodexTokenBundle } from "./codex-oauth";

interface PendingLogin {
  /** The user who initiated this login — only they may consume the resulting session. */
  userId: string;
  verifier: string;
  status: "pending" | "success" | "error";
  bundle?: CodexTokenBundle;
  error?: string;
  createdAt: number;
}

interface LoopbackState {
  server: Server | null;
  /** keyed by OAuth `state` (also used as the client-facing loginId). */
  pending: Map<string, PendingLogin>;
}

const PENDING_TTL_MS = 10 * 60 * 1000;
/** Cap concurrent in-flight logins per user so one account can't flood the shared pending map. */
const MAX_PENDING_PER_USER = 3;

const g = globalThis as unknown as { __codexLoopback?: LoopbackState };
const state: LoopbackState = g.__codexLoopback ?? (g.__codexLoopback = { server: null, pending: new Map() });

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of state.pending) {
    if (now - v.createdAt > PENDING_TTL_MS) state.pending.delete(k);
  }
  maybeStopServer();
}

/** Close the loopback listener once nothing is in flight, freeing port 1455 (mirrors 9router's stop). */
function maybeStopServer(): void {
  if (state.server !== null && state.pending.size === 0) {
    try {
      state.server.close();
    } catch {
      /* ignore */
    }
    state.server = null;
  }
}

function html(title: string, body: string): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f14;color:#e6edf3;display:grid;place-items:center;height:100vh;margin:0}main{max-width:30rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#9fb0c0;line-height:1.5}</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

async function handleCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${CODEX_OAUTH.loopbackHost}:${CODEX_OAUTH.loopbackPort}`);
  if (url.pathname !== CODEX_OAUTH.callbackPath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  sweep();
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state") ?? "";
  const oauthError = url.searchParams.get("error");
  const pending = state.pending.get(returnedState);

  const respond = (status: number, title: string, body: string): void => {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html(title, body));
  };

  if (pending === undefined) {
    respond(400, "Sesi tidak dikenal", "Permintaan login tidak cocok dengan sesi mana pun. Coba mulai ulang dari AgentBuff.");
    return;
  }
  if (oauthError !== null) {
    pending.status = "error";
    pending.error = oauthError;
    respond(400, "Login dibatalkan", "Kamu membatalkan atau menolak izin. Tutup tab ini dan coba lagi bila mau.");
    return;
  }
  if (code === null || code === "") {
    pending.status = "error";
    pending.error = "no_code";
    respond(400, "Kode tidak ada", "OpenAI tidak mengirim kode otorisasi. Tutup tab ini dan coba lagi.");
    return;
  }
  try {
    pending.bundle = await exchangeCode({ code, verifier: pending.verifier });
    pending.status = "success";
    respond(200, "Berhasil terhubung ✓", "ChatGPT (Codex) berhasil terhubung ke AgentBuff. Kamu bisa menutup tab ini dan kembali ke aplikasi.");
  } catch (e) {
    pending.status = "error";
    pending.error = e instanceof Error ? e.message : "exchange_failed";
    respond(502, "Gagal menukar token", "Tidak bisa menyelesaikan login dengan OpenAI. Tutup tab ini dan coba lagi.");
  }
}

function ensureServer(): Promise<void> {
  if (state.server !== null && state.server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleCallback(req, res);
    });
    server.once("error", (err: NodeJS.ErrnoException) => {
      state.server = null;
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${CODEX_OAUTH.loopbackPort} sedang dipakai (mungkin Codex CLI / app lain). Tutup dulu lalu coba lagi.`));
      } else {
        reject(new Error("Tidak bisa membuka listener login lokal untuk Codex."));
      }
    });
    server.listen(CODEX_OAUTH.loopbackPort, CODEX_OAUTH.loopbackHost, () => {
      state.server = server;
      resolve();
    });
  });
}

export interface StartLoginResult {
  loginId: string;
  authorizeUrl: string;
}

/**
 * Begin a Codex login for `userId`: bind the loopback listener (local-only), then return the authorize
 * URL + a loginId the client polls. The pending login is bound to userId so only that account can
 * consume the resulting session. Throws a friendly error if the loopback can't be bound (e.g. hosted)
 * or if the user already has too many in-flight logins.
 */
export async function startCodexLogin(userId: string): Promise<StartLoginResult> {
  sweep();
  const mine = [...state.pending.values()].filter((p) => p.userId === userId && p.status === "pending").length;
  if (mine >= MAX_PENDING_PER_USER) {
    throw new Error("Terlalu banyak percobaan login Codex yang tertunda. Selesaikan atau tunggu sebentar.");
  }
  await ensureServer();
  const pkce = generatePkce();
  const st = generateState();
  state.pending.set(st, { userId, verifier: pkce.verifier, status: "pending", createdAt: Date.now() });
  return { loginId: st, authorizeUrl: buildAuthorizeUrl({ challenge: pkce.challenge, state: st }) };
}

export interface PollResult {
  status: "pending" | "success" | "error";
  error?: string;
  bundle?: CodexTokenBundle;
}

/** Read (without consuming) the status of a pending login. Only the initiating user may read it. */
export function pollCodexLogin(loginId: string, userId: string): PollResult {
  sweep();
  const p = state.pending.get(loginId);
  if (p === undefined || p.userId !== userId) return { status: "error", error: "unknown_session" };
  return { status: p.status, error: p.error, bundle: p.bundle };
}

/** Consume a completed login (one-time): returns the bundle and deletes the entry. User-bound. */
export function consumeCodexLogin(loginId: string, userId: string): CodexTokenBundle | null {
  const p = state.pending.get(loginId);
  if (p === undefined || p.userId !== userId || p.status !== "success" || p.bundle === undefined) return null;
  state.pending.delete(loginId);
  maybeStopServer();
  return p.bundle;
}
