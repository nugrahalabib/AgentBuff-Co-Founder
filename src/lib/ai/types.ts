// src/lib/ai/types.ts
// Provider Abstraction Layer (PAL) — normalized types shared across providers.
// PRD §12.14. These types let business logic stay provider-agnostic.

export type ProviderId = "gemini" | "openai" | "openai_codex";

export type CredentialType = "api_key" | "oauth_token";

/**
 * A clickable source. BOTH Gemini (google_search) and OpenAI (web_search)
 * return url_citation annotations with url/title/start_index/end_index,
 * so we normalize them into ONE shape. PRD §9.2.1, §12.9, §12.15.
 */
export interface Citation {
  claimText?: string;
  startIndex: number;
  endIndex: number;
  sourceUrl: string;
  sourceTitle?: string;
  /** 'estimate' = no grounded source; UI must label it "estimasi". */
  confidence?: "grounded" | "estimate";
}

export interface Capabilities {
  groundedSearch: boolean;
  deepResearch: boolean;
  imageGen: boolean;       // e.g. OpenAI requires Org Verification for GPT Image
  vision: boolean;
  docUnderstanding: boolean;
  docAgentCli: boolean;
}

export interface Credential {
  provider: ProviderId;
  type: CredentialType;
  /** Decrypted in-memory ONLY at call time. Never log. Never persist plaintext. PRD §13.1 */
  secret: string;
  /**
   * Codex/"Sign in with ChatGPT" only: the `chatgpt-account-id` the ChatGPT backend requires
   * alongside the Bearer token. Decoded from the OAuth id_token. Undefined for API-key providers.
   */
  accountId?: string;
}

export interface GroundedResult {
  text: string;
  citations: Citation[];
  /** Full list of consulted URLs (>= citations). OpenAI exposes `sources`. */
  sources: { url: string; title?: string }[];
}

export interface DeepResearchHandle {
  reportId: string;
  status: "queued" | "running" | "completed" | "failed";
  text?: string;
  citations?: Citation[];
  sources?: { url: string; title?: string }[];
  /** provider-native id (Gemini interaction id / OpenAI response id) for polling */
  providerRef?: string;
}

export type TaskClass =
  | "parse_fast"
  | "deep_research"
  | "grounded_light"
  | "reasoning_heavy"
  | "image_gen"
  | "vision"
  | "doc_understanding"
  | "doc_agent";
