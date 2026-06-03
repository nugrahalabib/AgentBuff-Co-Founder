// src/lib/ai/model-routing.ts
// SINGLE place where model IDs live. PRD §12.2, §12.14.5.
//
// ⚠️ DO NOT hardcode model names anywhere else in the codebase.
// ⚠️ VERIFY every string below against the official model lists BEFORE production:
//      Gemini: https://ai.google.dev/gemini-api/docs/models  (+ Deprecations)
//      OpenAI: https://developers.openai.com/api/docs/models
//    Values here are placeholders captured 2026-05-30 and WILL change. Treat as config.

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
    gemini: "nano-banana-pro",            // verify exact id (or Imagen for photoreal)
    openai: "gpt-image-2",                // requires Org Verification
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

export function resolveModel(task: TaskClass, provider: ProviderId): string | undefined {
  return MODEL_ROUTING[task]?.[provider];
}
