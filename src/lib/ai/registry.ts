// src/lib/ai/registry.ts
// Provider selection (the "LLM Gateway"). PRD §12.14.4-5. Given a user + task class, pick a linked,
// capability-appropriate BYOK provider and decrypt its secret in-memory. Prefer the user's default;
// fall back to any active provider that supports the task (e.g. route image_gen to Gemini if the
// default OpenAI key isn't org-verified for images).

import { decryptSecret, type MasterKeyProvider } from "../crypto";
import type { CredentialStore } from "./credential-store";
import { GeminiAdapter } from "./gemini-adapter";
import type { LLMProvider, ProviderRegistry } from "./llm-provider";
import { OpenAIAdapter } from "./openai-adapter";
import type { Capabilities, Credential, ProviderId, TaskClass } from "./types";

export type ProviderErrorCode = "BYOK_KEY_MISSING" | "NO_PROVIDER_FOR_TASK";

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
  // Codex (Sign in with ChatGPT) speaks the same Responses surface; its OAuth auth lands later (§12.16).
  openai_codex: () => new OpenAIAdapter(),
};

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

    const cred: Credential = {
      provider: chosen.provider,
      type: chosen.credType,
      secret: decryptSecret(chosen.ciphertext, this.master),
    };
    return { provider: ADAPTERS[chosen.provider](), cred };
  }
}
