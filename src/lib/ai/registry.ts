// src/lib/ai/registry.ts
// Provider selection (the "LLM Gateway"). PRD §12.14.4-5. Given a user + task class, pick a linked,
// capability-appropriate BYOK provider and decrypt its secret in-memory. Prefer the user's default;
// fall back to any active provider that supports the task (e.g. route image_gen to Gemini if the
// default OpenAI key isn't org-verified for images).
//
// Codex/"Sign in with ChatGPT" credentials are oauth_token bundles (access + rotating refresh + the
// chatgpt-account-id) stored as encrypted JSON. At selection time we proactively refresh the access
// token (5-day lead) and re-persist the rotated bundle, so any LLM call always carries a fresh token.

import { decryptSecret, encryptSecret, fingerprint, type MasterKeyProvider } from "../crypto";
import type { CredentialStore, StoredCredential, UpsertableCredentialStore } from "./credential-store";
import { CodexAdapter } from "./codex-adapter";
import {
  CodexAuthError,
  needsRefresh,
  parseBundle,
  refreshTokens,
  serializeBundle,
} from "./codex-oauth";
import { GeminiAdapter } from "./gemini-adapter";
import type { LLMProvider, ProviderRegistry } from "./llm-provider";
import { OpenAIAdapter } from "./openai-adapter";
import type { Capabilities, Credential, ProviderId, TaskClass } from "./types";

export type ProviderErrorCode =
  | "BYOK_KEY_MISSING"
  | "NO_PROVIDER_FOR_TASK"
  | "CODEX_REAUTH"
  | "CODEX_REAUTH_TRANSIENT";

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const ADAPTERS: Record<ProviderId, () => LLMProvider> = {
  gemini: () => new GeminiAdapter(),
  openai: () => new OpenAIAdapter(),
  // Codex (Sign in with ChatGPT) is served against the ChatGPT backend, NOT api.openai.com. §12.16
  openai_codex: () => new CodexAdapter(),
};

/** Construct the LLM adapter for a provider (shared by the registry and credential health checks). */
export function adapterFor(provider: ProviderId): LLMProvider {
  return ADAPTERS[provider]();
}

function isUpsertable(store: CredentialStore): store is UpsertableCredentialStore {
  return typeof (store as UpsertableCredentialStore).upsert === "function";
}

/** Capability each task class requires for capability-aware selection. Undefined = any provider works. */
const TASK_CAPABILITY: Partial<Record<TaskClass, keyof Capabilities>> = {
  deep_research: "deepResearch",
  grounded_light: "groundedSearch",
  image_gen: "imageGen",
  vision: "vision",
  doc_understanding: "docUnderstanding",
  doc_agent: "docAgentCli",
};

export class DefaultProviderRegistry implements ProviderRegistry {
  constructor(
    private readonly store: CredentialStore,
    private readonly master: MasterKeyProvider,
  ) {}

  async forTask(userId: string, task: string): Promise<{ provider: LLMProvider; cred: Credential }> {
    const active = (await this.store.listForUser(userId)).filter((c) => c.status === "active");
    if (active.length === 0) {
      throw new ProviderError("BYOK_KEY_MISSING", "Belum ada kredensial AI aktif untuk pengguna ini.");
    }

    // Default first, then capability-aware fallback.
    const ordered = [...active].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    const requiredCap = TASK_CAPABILITY[task as TaskClass];
    const chosen =
      requiredCap === undefined ? ordered[0] : ordered.find((c) => c.capabilities[requiredCap]);

    if (chosen === undefined) {
      throw new ProviderError("NO_PROVIDER_FOR_TASK", `Tidak ada provider tertaut yang mendukung task "${task}".`);
    }

    const { secret, accountId } = await this.resolveSecret(chosen);
    const cred: Credential = { provider: chosen.provider, type: chosen.credType, secret, accountId };
    return { provider: ADAPTERS[chosen.provider](), cred };
  }

  /** Decrypt the stored secret; for Codex, parse the token bundle and proactively refresh + re-persist. */
  private async resolveSecret(chosen: StoredCredential): Promise<{ secret: string; accountId?: string }> {
    const decrypted = decryptSecret(chosen.ciphertext, this.master);
    if (!(chosen.credType === "oauth_token" && chosen.provider === "openai_codex")) {
      return { secret: decrypted };
    }

    let bundle = parseBundle(decrypted);
    if (needsRefresh(bundle) && bundle.refreshToken !== undefined) {
      const expired = bundle.expiresAt <= Date.now();
      if (!isUpsertable(this.store)) {
        // Rotating refresh tokens are one-time-use; without a place to persist the rotated value we must
        // NOT consume it. Serve the still-valid current token, or force re-auth if it's already expired.
        if (expired) {
          throw new ProviderError("CODEX_REAUTH", "Sesi Codex perlu disegarkan tetapi penyimpanan tidak tersedia. Login ulang.");
        }
      } else {
        const store = this.store;
        try {
          const refreshed = await refreshTokens(bundle);
          // Persist the rotated bundle BEFORE serving it. If the write fails, the new (one-time) refresh
          // token would be lost permanently — so abort instead of silently serving a soon-to-brick token.
          try {
            await store.upsert({
              ...chosen,
              ciphertext: encryptSecret(serializeBundle(refreshed), this.master),
              fingerprint: fingerprint(refreshed.accessToken),
            });
          } catch {
            throw new ProviderError("CODEX_REAUTH_TRANSIENT", "Gagal menyimpan sesi Codex yang disegarkan. Coba lagi sebentar.");
          }
          bundle = refreshed;
        } catch (e) {
          if (e instanceof ProviderError) throw e;
          if (e instanceof CodexAuthError && e.unrecoverable) {
            await store.patchMeta(chosen.userId, chosen.provider, { status: "invalid" });
            throw new ProviderError("CODEX_REAUTH", "Sesi Codex/ChatGPT berakhir. Silakan login ulang dengan ChatGPT.");
          }
          // Transient refresh failure (network/5xx). If the current token is still within its validity
          // window, serve it; if it's already expired, serving is pointless → surface a transient error.
          if (expired) {
            throw new ProviderError("CODEX_REAUTH_TRANSIENT", "Tidak bisa menyegarkan sesi Codex. Coba lagi sebentar.");
          }
        }
      }
    }
    return { secret: bundle.accessToken, accountId: bundle.chatgptAccountId };
  }
}
