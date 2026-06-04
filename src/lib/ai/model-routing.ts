// src/lib/ai/model-routing.ts
// SINGLE place where model IDs live. PRD §12.2, §12.14.5.
//
// ⚠️ DO NOT hardcode model names anywhere else in the codebase.
// ⚠️ Defaults below are sane current values (cross-checked via context7, 2026-06), but model names move.
//    EVERY id is overridable at runtime with NO code change via an env var:
//        MODEL_<TASK>_<PROVIDER>   e.g. MODEL_REASONING_HEAVY_GEMINI=gemini-3-pro
//                                       MODEL_IMAGE_GEN_OPENAI=gpt-image-1
//    So if a default ever 404s, set the right id in .env.local. See docs/INFRA-SETUP.md.

import type { ProviderId, TaskClass } from "./types";

type Routing = Partial<Record<ProviderId, string>>;

export const MODEL_ROUTING: Record<TaskClass, Routing> = {
  parse_fast: {
    gemini: "gemini-flash-lite",          // TODO verify exact id
    openai: "gpt-5-mini",                 // TODO verify exact id
  },
  deep_research: {
    gemini: "deep-research-preview-04-2026",       // Interactions API agent — verify
    openai: "o3-deep-research",                    // Responses API — verify (or o4-mini-deep-research for cost)
  },
  grounded_light: {
    gemini: "gemini-flash",               // + tool google_search
    openai: "gpt-5.5",                    // + tool web_search
  },
  reasoning_heavy: {
    gemini: "gemini-pro",                 // or flash + high thinking_level
    openai: "gpt-5.5",                    // reasoning.effort = high
  },
  image_gen: {
    gemini: "gemini-3-pro-image-preview", // Nano Banana Pro (Gemini 3 Pro Image) — confirmed 2026-06
    openai: "gpt-image-1",                // GPT Image (requires Org Verification)
  },
  vision: {
    gemini: "gemini-flash",
    openai: "gpt-5.5",
  },
  doc_understanding: {
    gemini: "gemini-flash",               // PDF vision (Files API for large)
    openai: "gpt-5.5",                    // input_file / file_search
  },
  doc_agent: {
    // CLI agents are selected by DocAgentRunner, not a model string here.
    gemini: "gemini-cli",                 // or antigravity-cli (transition ~2026-06-18)
    openai: "codex-cli",                  // gpt-5.x-codex family
  },
};

export const API_NOTES = {
  geminiInteractions: { endpoint: "/v1beta/interactions", authHeader: "x-goog-api-key", apiRevision: "VERIFY (e.g. 2026-05-20)" },
  openaiResponses: { endpoint: "https://api.openai.com/v1/responses", authHeader: "Authorization: Bearer" },
} as const;

/** Env override for a task×provider model id, or undefined. e.g. MODEL_IMAGE_GEN_GEMINI. */
function envOverride(task: TaskClass, provider: ProviderId): string | undefined {
  const key = `MODEL_${task.toUpperCase()}_${provider.toUpperCase()}`;
  const v = process.env[key];
  return v !== undefined && v.length > 0 ? v : undefined;
}

export function resolveModel(task: TaskClass, provider: ProviderId): string | undefined {
  return envOverride(task, provider) ?? MODEL_ROUTING[task]?.[provider];
}

/** Reverse lookup: which provider owns a given model id (single source of truth). */
export function providerOfModel(model: string | undefined): ProviderId | "unknown" {
  if (model === undefined) return "unknown";
  for (const task of Object.keys(MODEL_ROUTING) as TaskClass[]) {
    for (const [prov, id] of Object.entries(MODEL_ROUTING[task])) {
      if (id === model) return prov as ProviderId;
    }
  }
  return "unknown";
}
