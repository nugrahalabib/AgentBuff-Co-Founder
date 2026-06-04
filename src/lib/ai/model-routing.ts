// src/lib/ai/model-routing.ts
// SINGLE place where model IDs live. PRD §12.2, §12.14.5.
//
// ⚠️ DO NOT hardcode model names anywhere else in the codebase.
// ⚠️ Defaults verified against OFFICIAL docs via context7 on 2026-06-04
//    (ai.google.dev/gemini-api + developers.openai.com) and cross-checked vs the 9router
//    reference project. They favour GA-stable ids that work on a free/basic BYOK key.
//    Newer-but-gated ids are listed in comments; switch with NO code change via an env var:
//        MODEL_<TASK>_<PROVIDER>   e.g. MODEL_REASONING_HEAVY_GEMINI=gemini-3.1-pro-preview
//                                       MODEL_GROUNDED_LIGHT_OPENAI=gpt-5.5
//    So if a default ever 404s, set the right id in .env.local. See docs/INFRA-SETUP.md.
//
//    Gemini GA family (reliable):   gemini-2.5-flash-lite · gemini-2.5-flash · gemini-2.5-pro
//    Gemini newest (may be gated):  gemini-3.5-flash · gemini-3.1-flash-lite · gemini-3.1-pro-preview
//    OpenAI GA family (reliable):   gpt-5-mini · gpt-5.2 (+ -pro)   newest guide slug: gpt-5.5
//    Codex (ChatGPT backend OAuth): gpt-5-codex  → served via CodexAdapter, NOT api.openai.com

import type { ProviderId, TaskClass } from "./types";

type Routing = Partial<Record<ProviderId, string>>;

export const MODEL_ROUTING: Record<TaskClass, Routing> = {
  parse_fast: {
    gemini: "gemini-2.5-flash-lite",      // GA; newest: gemini-3.1-flash-lite
    openai: "gpt-5-mini",                 // GA since 2025-08
    openai_codex: "gpt-5-codex",          // ChatGPT-backend Codex
  },
  deep_research: {
    // No dedicated "deep-research" model id exists on either vendor now — Deep Research is
    // an orchestration (grounded search + reasoning) over a normal reasoning model. (§9.2)
    gemini: "gemini-2.5-pro",             // Interactions/grounded agent base
    openai: "gpt-5.2",                    // Responses background + web_search
  },
  grounded_light: {
    gemini: "gemini-2.5-flash",           // + tool google_search; newest: gemini-3.5-flash
    openai: "gpt-5.2",                    // + tool web_search; newest guide slug: gpt-5.5
    openai_codex: "gpt-5-codex",
  },
  reasoning_heavy: {
    gemini: "gemini-2.5-pro",             // newest: gemini-3.1-pro-preview
    openai: "gpt-5.2",                    // reasoning.effort = high
    openai_codex: "gpt-5-codex",
  },
  image_gen: {
    gemini: "gemini-3-pro-image-preview", // Nano Banana Pro (Gemini 3 Pro Image) — confirmed 2026-06
    openai: "gpt-image-1",                // GPT Image (requires Org Verification)
  },
  vision: {
    gemini: "gemini-2.5-flash",
    openai: "gpt-5.2",
    openai_codex: "gpt-5-codex",
  },
  doc_understanding: {
    gemini: "gemini-2.5-flash",           // PDF vision (Files API for large)
    openai: "gpt-5.2",                    // input_file / file_search
    openai_codex: "gpt-5-codex",
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
