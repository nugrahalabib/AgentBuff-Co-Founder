// src/lib/ai/model-routing.ts
// SINGLE place where model IDs live. PRD §12.2, §12.14.5.
//
// ⚠️ DO NOT hardcode model names anywhere else in the codebase.
// ⚠️ Defaults verified 2026-06-04 against the OFFICIAL vendor docs named in the PRD
//    (developers.openai.com + ai.google.dev) — NOT third-party mirrors. They match PRD §12.15/§12.16
//    and favour IDs that work on a free/standard BYOK key where possible.
//    EVERY id is overridable at runtime with NO code change via an env var:
//        MODEL_<TASK>_<PROVIDER>   e.g. MODEL_REASONING_HEAVY_OPENAI=gpt-5.5-pro
//                                       MODEL_IMAGE_GEN_GEMINI=gemini-3.1-flash-image
//    So if a default ever 404s, set the right id in .env.local. See docs/AUTH-SETUP.md.
//
//    OpenAI (live): flagship gpt-5.5 (snapshot gpt-5.5-2026-04-23) · gpt-5.5-pro (background) ·
//      gpt-5.4 / gpt-5.4-mini (cheap) · deep research o3-deep-research / o4-mini-deep-research ·
//      image gpt-image-2 (also -1.5/-1/-1-mini) · reasoning.effort ∈ {none,low,medium,high,xhigh}.
//    Gemini (live): gemini-3.5-flash (stable) · gemini-3.1-flash-lite (stable) · gemini-3.1-pro-preview
//      (PAID) · gemini-2.5-{flash,flash-lite,pro} (free tier) · image Nano Banana Pro = gemini-3-pro-image
//      (PAID, no free tier) · deep research (Interactions only) deep-research-preview-04-2026.
//      NOTE: bare aliases gemini-flash / gemini-pro / gemini-flash-lite are NOT valid model ids.
//    Codex (ChatGPT backend OAuth): gpt-5.3-codex → served via CodexAdapter, NOT api.openai.com.

import type { ProviderId, TaskClass } from "./types";

type Routing = Partial<Record<ProviderId, string>>;

export const MODEL_ROUTING: Record<TaskClass, Routing> = {
  parse_fast: {
    gemini: "gemini-2.5-flash-lite",      // free tier; newer: gemini-3.1-flash-lite
    openai: "gpt-5.4-mini",               // "strongest mini model yet" (cheap/fast)
    openai_codex: "gpt-5.3-codex",        // ChatGPT-backend Codex
  },
  deep_research: {
    // Standard/quality tier. The -max / cheaper variants live in DEEP_RESEARCH_ROUTING below.
    gemini: "deep-research-preview-04-2026",   // Interactions API agent slug (NOT a generateContent model)
    openai: "o3-deep-research",                // Responses API + background=true + ≥1 data source
  },
  grounded_light: {
    gemini: "gemini-3.5-flash",           // + tool google_search (larger free grounding pool on Gemini 3)
    openai: "gpt-5.5",                    // + tool web_search → url_citation
    openai_codex: "gpt-5.3-codex",
  },
  reasoning_heavy: {
    gemini: "gemini-3.5-flash",           // PRD §9.2.5: prefer Flash + high thinking over Pro (free quota)
    openai: "gpt-5.5",                    // reasoning.effort = high / xhigh
    openai_codex: "gpt-5.3-codex",
  },
  image_gen: {
    gemini: "gemini-3-pro-image",         // Nano Banana Pro (PAID — no free tier; capability-gated)
    openai: "gpt-image-2",                // GPT Image 2 (requires Org Verification; no transparent bg)
  },
  vision: {
    gemini: "gemini-3.5-flash",
    openai: "gpt-5.5",
    openai_codex: "gpt-5.3-codex",
  },
  doc_understanding: {
    gemini: "gemini-3.5-flash",           // PDF vision ≤50MB/1000 pages (Files API for large)
    openai: "gpt-5.5",                    // input_file / file_search
    openai_codex: "gpt-5.3-codex",
  },
  doc_agent: {
    // CLI agents are selected by DocAgentRunner, not a model string here.
    gemini: "gemini-cli",                 // or antigravity-cli (transition ~2026-06-18)
    openai: "codex-cli",                  // gpt-5.x-codex family
  },
};

/**
 * Deep Research has distinct quality vs economy agent ids per vendor (PRD §12.8/§12.14.5/§12.15).
 * `max` = the most comprehensive option; otherwise the faster/cheaper tier.
 *   Gemini: deep-research-preview-04-2026 (fast) · deep-research-max-preview-04-2026 (comprehensive).
 *   OpenAI: o4-mini-deep-research ($2/$8, economy) · o3-deep-research ($10/$40, quality).
 */
export const DEEP_RESEARCH_ROUTING: Partial<Record<ProviderId, { standard: string; max: string }>> = {
  gemini: { standard: "deep-research-preview-04-2026", max: "deep-research-max-preview-04-2026" },
  openai: { standard: "o4-mini-deep-research", max: "o3-deep-research" },
};

export const API_NOTES = {
  geminiInteractions: { endpoint: "/v1beta/interactions", authHeader: "x-goog-api-key", apiRevision: "2026-05-20" },
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

/**
 * Resolve the Deep Research agent/model id for a provider, honoring the comprehensive (`max`) tier and
 * the MODEL_DEEP_RESEARCH_<PROVIDER>(_MAX) env overrides. Falls back to MODEL_ROUTING.deep_research.
 */
export function resolveDeepResearchAgent(provider: ProviderId, max = false): string | undefined {
  const suffix = max ? "_MAX" : "";
  const envKey = `MODEL_DEEP_RESEARCH_${provider.toUpperCase()}${suffix}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined && envVal.length > 0) return envVal;
  const variants = DEEP_RESEARCH_ROUTING[provider];
  if (variants !== undefined) return max ? variants.max : variants.standard;
  return resolveModel("deep_research", provider);
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
