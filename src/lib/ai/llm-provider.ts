// src/lib/ai/llm-provider.ts
// The Provider Abstraction Layer contract. PRD §12.14.
// Business/UI code depends ONLY on this interface — never on a vendor SDK directly.

import type {
  Capabilities,
  Citation,
  Credential,
  DeepResearchHandle,
  GroundedResult,
  TaskClass,
} from "./types";

export interface StructuredOpts {
  /** JSON Schema the output MUST conform to (Structured Outputs). PRD §12.15 */
  jsonSchema: object;
  /** Maps to thinking_level (Gemini) / reasoning.effort (OpenAI ∈ {low,medium,high,xhigh}). */
  reasoning?: "minimal" | "low" | "medium" | "high" | "xhigh";
  systemPrompt?: string;
  /** Task class used for config-driven model routing (model-routing.ts). Defaults to "reasoning_heavy". */
  task?: TaskClass;
}

export interface ImageOpts {
  n?: number;
  size?: string;
  /** brand design tokens to seed style/colors/brand-name text */
  brandTokens?: Record<string, string>;
}

/**
 * Every provider adapter (GeminiAdapter, OpenAIAdapter, ...) implements this.
 * Adding a provider = a new thin adapter, no change to business logic.
 */
export interface LLMProvider {
  readonly id: string;

  validateCredential(cred: Credential): Promise<{
    ok: boolean;
    capabilities: Capabilities;
    detail?: string;
  }>;

  /** Structured Outputs (JSON Schema). Output is validated by the caller too. */
  generateStructured<T = unknown>(
    cred: Credential,
    prompt: string,
    opts: StructuredOpts
  ): Promise<T>;

  /** Web search grounding → text + normalized url_citation. PRD §9.2/§12.9 */
  groundedSearch(
    cred: Credential,
    query: string,
    opts?: { maxQueries?: number }
  ): Promise<GroundedResult>;

  /** Long async research (background). Returns a handle to poll. PRD §9.2/§12.8/§12.15 */
  runDeepResearch(
    cred: Credential,
    brief: string,
    opts?: { max?: boolean }
  ): Promise<DeepResearchHandle>;
  pollDeepResearch(cred: Credential, handle: DeepResearchHandle): Promise<DeepResearchHandle>;

  /** Brand assets. Returns a storage ref (image bytes go to object storage). PRD §9.4 */
  generateImage(cred: Credential, prompt: string, opts?: ImageOpts): Promise<{ imageRef: string }>;

  /** Vision: OCR / analysis / QA on an image. PRD §9.4.5 / §12.10 */
  understandImage<T = unknown>(cred: Credential, imageRef: string, prompt: string, jsonSchema?: object): Promise<T>;

  /** Parse a PDF/doc into structured fields (pre-fill wizard). PRD §9.3.4.1 / §12.11 */
  understandDocument<T = unknown>(cred: Credential, fileRef: string, jsonSchema: object): Promise<T>;
}

/** Resolve the active provider for a given task + user (capability-aware). PRD §12.14.4-5 */
export interface ProviderRegistry {
  forTask(userId: string, task: string): Promise<{ provider: LLMProvider; cred: Credential }>;
}
