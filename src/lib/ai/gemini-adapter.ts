// src/lib/ai/gemini-adapter.ts
// Gemini adapter — implemented against the official Gemini API (verified via context7, 2026-06).
//   Models list (key validation): GET /v1beta/models            https://ai.google.dev/gemini-api/docs/api-key
//   Structured Outputs: generateContent + generationConfig.responseMimeType/responseSchema
//                                                                https://ai.google.dev/gemini-api/docs/structured-output
//   Google Search grounding: tools:[{google_search:{}}] → candidates[].groundingMetadata
//     (groundingChunks[].web + groundingSupports[].segment)    https://ai.google.dev/gemini-api/docs/grounding
//   Thinking: generationConfig.thinkingConfig.thinkingLevel    https://ai.google.dev/gemini-api/docs/thinking
//   Auth header: x-goog-api-key (decrypted in-memory per call; never logged). PRD §12.8–§12.13, §13.1.
//
// We call the REST API with fetch (no vendor SDK) so the PAL stays lean and every wire shape is auditable.
// Deep Research (Interactions API), image generation (Nano Banana), and document/vision are later milestones.

import type { LLMProvider, StructuredOpts, ImageOpts } from "./llm-provider";
import type {
  Capabilities,
  Citation,
  Credential,
  DeepResearchHandle,
  GroundedResult,
  TaskClass,
} from "./types";
import { resolveModel } from "./model-routing";
import { withRetry } from "./retry";
import { parseAndValidate } from "./schema-validate";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Raised for any non-success Gemini HTTP response. `transient` marks retryable (429/5xx/network) errors. */
export class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

// --- Minimal response shapes (only the fields we read). ---
interface GeminiPart {
  text?: string;
}
interface GroundingChunk {
  web?: { uri?: string; title?: string };
}
interface GroundingSupport {
  segment?: { startIndex?: number; endIndex?: number; text?: string };
  groundingChunkIndices?: number[];
}
interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  webSearchQueries?: string[];
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  groundingMetadata?: GroundingMetadata;
  finishReason?: string;
}
interface GenerateContentResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

/** Map the PAL reasoning levels onto Gemini 3 `thinkingLevel`. PRD §12.4. */
export function mapThinkingLevel(reasoning: NonNullable<StructuredOpts["reasoning"]>): "low" | "high" {
  return reasoning === "minimal" || reasoning === "low" ? "low" : "high";
}

/** Classify a key-validation HTTP status into the PAL liveness outcome. PRD §9.1.4. */
export function classifyValidationStatus(status: number):
  | { kind: "ok" }
  | { kind: "rejected"; detail: string }
  | { kind: "transient"; detail: string } {
  if (status >= 200 && status < 300) return { kind: "ok" };
  if (status === 429) return { kind: "ok" }; // valid key, just rate-limited
  if (status === 400 || status === 401 || status === 403) {
    return { kind: "rejected", detail: "Kredensial ditolak. Periksa kembali API key-mu." };
  }
  return { kind: "transient", detail: "Layanan AI sedang bermasalah. Coba lagi sebentar." };
}

/** Normalize Gemini grounding metadata into clickable Citations + a unique source list. PRD §9.2.1, §12.9. */
export function groundingToCitations(metadata: GroundingMetadata | undefined): {
  citations: Citation[];
  sources: { url: string; title?: string }[];
} {
  const chunks = metadata?.groundingChunks ?? [];
  const citations: Citation[] = [];
  for (const support of metadata?.groundingSupports ?? []) {
    const segment = support.segment;
    if (segment === undefined) continue;
    for (const index of support.groundingChunkIndices ?? []) {
      const web = chunks[index]?.web;
      if (web?.uri === undefined) continue;
      citations.push({
        claimText: segment.text,
        startIndex: segment.startIndex ?? 0,
        endIndex: segment.endIndex ?? 0,
        sourceUrl: web.uri,
        sourceTitle: web.title,
        confidence: "grounded",
      });
    }
  }

  const seen = new Set<string>();
  const sources: { url: string; title?: string }[] = [];
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (url === undefined || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: chunk.web?.title });
  }
  return { citations, sources };
}

function requireModel(task: TaskClass): string {
  const model = resolveModel(task, "gemini");
  if (model === undefined) {
    throw new GeminiApiError(`Tidak ada model Gemini terkonfigurasi untuk task "${task}".`, 0, false);
  }
  return model;
}

/** Concatenate the text parts of the first candidate. */
function extractText(data: GenerateContentResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export class GeminiAdapter implements LLMProvider {
  readonly id = "gemini";

  /** POST a generateContent request and return the parsed response, mapping HTTP errors. */
  private async generateContent(
    cred: Credential,
    model: string,
    body: Record<string, unknown>,
  ): Promise<GenerateContentResponse> {
    // Retry transient (429/5xx/network) errors with exponential backoff. PRD §12.5.
    return withRetry(async () => {
      let res: Response;
      try {
        res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": cred.secret },
          body: JSON.stringify(body),
        });
      } catch {
        // Network failure — never include the key in the message.
        throw new GeminiApiError("Gagal menghubungi Gemini API.", 0, true);
      }
      if (!res.ok) {
        const c = classifyValidationStatus(res.status);
        const detail = c.kind === "ok" ? "" : c.detail;
        throw new GeminiApiError(detail || `Gemini API error ${res.status}.`, res.status, res.status >= 500 || res.status === 429);
      }
      const data = (await res.json()) as GenerateContentResponse;
      if (data.promptFeedback?.blockReason !== undefined) {
        throw new GeminiApiError(`Permintaan diblokir Gemini (${data.promptFeedback.blockReason}).`, 200, false);
      }
      if (data.candidates === undefined || data.candidates.length === 0) {
        throw new GeminiApiError("Gemini tidak mengembalikan kandidat jawaban.", 200, false);
      }
      return data;
    });
  }

  async validateCredential(
    cred: Credential,
  ): Promise<{ ok: boolean; capabilities: Capabilities; detail?: string }> {
    // Cheapest liveness probe: list models. PRD §9.1.4.
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/models`, {
        method: "GET",
        headers: { "x-goog-api-key": cred.secret },
      });
    } catch {
      throw new GeminiApiError("Gagal menghubungi Gemini API.", 0, true);
    }

    const outcome = classifyValidationStatus(res.status);
    const capabilities: Capabilities = {
      // A valid Gemini key has access to this capability profile; finer per-feature gating
      // (e.g. Deep Research preview) is detected lazily at call time with graceful fallback. PRD §12.14.4.
      groundedSearch: true,
      deepResearch: true,
      imageGen: true,
      vision: true,
      docUnderstanding: true,
      docAgentCli: true,
    };

    if (outcome.kind === "ok") return { ok: true, capabilities };
    if (outcome.kind === "rejected") {
      const empty: Capabilities = {
        groundedSearch: false,
        deepResearch: false,
        imageGen: false,
        vision: false,
        docUnderstanding: false,
        docAgentCli: false,
      };
      return { ok: false, capabilities: empty, detail: outcome.detail };
    }
    throw new GeminiApiError(outcome.detail, res.status, true);
  }

  async generateStructured<T = unknown>(cred: Credential, prompt: string, opts: StructuredOpts): Promise<T> {
    const model = requireModel(opts.task ?? "reasoning_heavy");
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      responseSchema: opts.jsonSchema,
    };
    if (opts.reasoning !== undefined) {
      generationConfig["thinkingConfig"] = { thinkingLevel: mapThinkingLevel(opts.reasoning) };
    }
    const makeBody = (text: string): Record<string, unknown> => {
      const body: Record<string, unknown> = { contents: [{ role: "user", parts: [{ text }] }], generationConfig };
      if (opts.systemPrompt !== undefined) body["systemInstruction"] = { parts: [{ text: opts.systemPrompt }] };
      return body;
    };

    // 1) generate, 2) validate against JSON Schema, 3) one repair attempt, else fail. PRD §12.5.
    const first = extractText(await this.generateContent(cred, model, makeBody(prompt)));
    const r1 = parseAndValidate<T>(first, opts.jsonSchema);
    if (r1.ok) return r1.value;

    const repairPrompt = `${prompt}\n\nCATATAN: Output JSON sebelumnya TIDAK valid terhadap schema (${r1.errors}). Kembalikan HANYA JSON yang valid persis sesuai schema, tanpa teks lain.`;
    const second = extractText(await this.generateContent(cred, model, makeBody(repairPrompt)));
    const r2 = parseAndValidate<T>(second, opts.jsonSchema);
    if (r2.ok) return r2.value;
    throw new GeminiApiError(`Output Gemini tidak valid terhadap schema setelah perbaikan (${r2.errors}).`, 200, false);
  }

  async groundedSearch(
    cred: Credential,
    query: string,
    _opts?: { maxQueries?: number },
  ): Promise<GroundedResult> {
    const model = requireModel("grounded_light");
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    };
    const data = await this.generateContent(cred, model, body);
    const text = extractText(data);
    const { citations, sources } = groundingToCitations(data.candidates?.[0]?.groundingMetadata);
    return { text, citations, sources };
  }

  // --- Later milestones (Interactions API / Nano Banana / Files API). Verify shapes before implementing. ---

  async runDeepResearch(_cred: Credential, _brief: string, _opts?: { max?: boolean }): Promise<DeepResearchHandle> {
    // Interactions API (`/v1beta/interactions`, Api-Revision header, background=true, then poll). PRD §12.8. Fase 1.
    throw new GeminiApiError("Deep Research (Interactions API) belum diimplementasikan (Fase 1).", 501, false);
  }
  async pollDeepResearch(_cred: Credential, _handle: DeepResearchHandle): Promise<DeepResearchHandle> {
    throw new GeminiApiError("Deep Research polling belum diimplementasikan (Fase 1).", 501, false);
  }
  async generateImage(_cred: Credential, _prompt: string, _opts?: ImageOpts): Promise<{ imageRef: string }> {
    // Nano Banana via BYOK → object storage. PRD §9.4, §12.10. Fase 2.
    throw new GeminiApiError("Generasi gambar (Nano Banana) belum diimplementasikan (Fase 2).", 501, false);
  }
  async understandImage<T = unknown>(
    _cred: Credential,
    _imageRef: string,
    _prompt: string,
    _jsonSchema?: object,
  ): Promise<T> {
    throw new GeminiApiError("Vision/OCR belum diimplementasikan (Fase 2).", 501, false);
  }
  async understandDocument<T = unknown>(_cred: Credential, _fileRef: string, _jsonSchema: object): Promise<T> {
    // Document Understanding (vision over PDF, Files API for large). PRD §9.3.4.1, §12.11. Fase 1.
    throw new GeminiApiError("Document Understanding belum diimplementasikan (Fase 1).", 501, false);
  }
}
