// src/lib/ai/gemini-adapter.ts
// Gemini adapter — implemented against the official Gemini API (verified against ai.google.dev, 2026-06-04).
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
import { resolveDeepResearchAgent, resolveModel } from "./model-routing";
import { withRetry } from "./retry";
import { parseAndValidate } from "./schema-validate";
import { isHttpUrl } from "./url-safety";

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
interface GeminiInlineData {
  mimeType?: string;
  data?: string;
}
interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
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

/** Interactions API response (Deep Research). Preview shape — read defensively. PRD §12.8. */
interface InteractionResponse {
  id?: string;
  name?: string;
  status?: string;
  output_text?: string;
  error?: { message?: string };
  candidates?: GeminiCandidate[];
}

/** Map an Interactions/Responses status string onto the PAL handle status. */
export function mapInteractionStatus(status: string | undefined): DeepResearchHandle["status"] {
  switch (status) {
    case "completed":
    case "succeeded":
      return "completed";
    case "failed":
    case "cancelled":
    case "error":
      return "failed";
    case "queued":
    case "pending":
      return "queued";
    default:
      return "running";
  }
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
      const uri = web?.uri;
      if (!isHttpUrl(uri)) continue; // drop non-http(s) (data:/javascript:/relative) citation URLs
      citations.push({
        claimText: segment.text,
        startIndex: segment.startIndex ?? 0,
        endIndex: segment.endIndex ?? 0,
        sourceUrl: uri,
        sourceTitle: web?.title,
        confidence: "grounded",
      });
    }
  }

  const seen = new Set<string>();
  const sources: { url: string; title?: string }[] = [];
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!isHttpUrl(url) || seen.has(url)) continue;
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

  /** Interactions API call (Deep Research agent). Background create + poll. PRD §12.8. */
  private async interactions(cred: Credential, method: "POST" | "GET", path: string, body?: Record<string, unknown>): Promise<InteractionResponse> {
    const apiRevision = process.env.GEMINI_API_REVISION ?? "2026-05-20"; // VERIFY against docs before prod (§12.13)
    return withRetry(async () => {
      let res: Response;
      try {
        res = await fetch(`${GEMINI_BASE}/interactions${path}`, {
          method,
          headers: { "Content-Type": "application/json", "x-goog-api-key": cred.secret, "Api-Revision": apiRevision },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch {
        throw new GeminiApiError("Gagal menghubungi Gemini Interactions API.", 0, true);
      }
      if (!res.ok) {
        const c = classifyValidationStatus(res.status);
        throw new GeminiApiError(c.kind === "ok" ? "" : c.detail || `Interactions error ${res.status}.`, res.status, res.status >= 500 || res.status === 429);
      }
      return (await res.json()) as InteractionResponse;
    });
  }

  async runDeepResearch(cred: Credential, brief: string, opts?: { max?: boolean }): Promise<DeepResearchHandle> {
    // Official Interactions Deep Research agent slugs (NOT a generateContent model id). §9.2.5 Jalur A, §12.8.
    // Background execution requires store=true; agent_config carries the documented type + planning flags.
    const agent = resolveDeepResearchAgent("gemini", opts?.max === true);
    const body: Record<string, unknown> = {
      agent,
      input: brief,
      background: true,
      store: true,
      agent_config: { type: "deep-research", thinking_summaries: "auto", collaborative_planning: true },
    };
    const data = await this.interactions(cred, "POST", "", body);
    const ref = data.id ?? data.name ?? "";
    return { reportId: ref, status: mapInteractionStatus(data.status), providerRef: ref };
  }

  async pollDeepResearch(cred: Credential, handle: DeepResearchHandle): Promise<DeepResearchHandle> {
    if (handle.providerRef === undefined || handle.providerRef === "") {
      throw new GeminiApiError("providerRef interaction tidak ada untuk polling.", 400, false);
    }
    const data = await this.interactions(cred, "GET", `/${handle.providerRef}`, undefined);
    const status = mapInteractionStatus(data.status);
    if (status !== "completed") return { ...handle, status };
    const { citations, sources } = groundingToCitations(data.candidates?.[0]?.groundingMetadata);
    return { ...handle, status, text: data.output_text ?? extractText(data as GenerateContentResponse), citations, sources };
  }
  async generateImage(cred: Credential, prompt: string, _opts?: ImageOpts): Promise<{ imageRef: string }> {
    // Nano Banana (image model) via generateContent → inline image bytes. PRD §9.4, §12.10.
    // Returned as a data URL; object storage (expiring URLs) lands with the storage seam. §9.4.7.
    const model = requireModel("image_gen");
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Nano Banana image models expect BOTH modalities; we still extract only the inlineData image part.
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };
    const data = await this.generateContent(cred, model, body);
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p) => p.inlineData?.data !== undefined)?.inlineData;
    if (inline?.data === undefined) {
      throw new GeminiApiError("Gemini tidak mengembalikan gambar.", 200, false);
    }
    return { imageRef: `data:${inline.mimeType ?? "image/png"};base64,${inline.data}` };
  }
  async understandImage<T = unknown>(cred: Credential, imageRef: string, prompt: string, jsonSchema?: object): Promise<T> {
    return this.understandInline<T>(cred, imageRef, prompt, "vision", jsonSchema);
  }

  async understandDocument<T = unknown>(cred: Credential, fileRef: string, jsonSchema: object): Promise<T> {
    // Document Understanding (vision over PDF/image). PRD §9.3.4.1, §12.11.
    return this.understandInline<T>(
      cred,
      fileRef,
      "Ekstrak field terstruktur dari dokumen ini sesuai schema. Jangan mengarang nilai yang tak terbaca.",
      "doc_understanding",
      jsonSchema,
    );
  }

  /** Shared vision/doc path: inline the (data-URL) bytes + prompt → optional structured output. */
  private async understandInline<T>(cred: Credential, ref: string, prompt: string, task: TaskClass, jsonSchema?: object): Promise<T> {
    const inline = parseInlineData(ref);
    if (inline === null) {
      throw new GeminiApiError("Sumber harus berupa data URL (data:<mime>;base64,...).", 400, false);
    }
    const model = requireModel(task);
    const generationConfig: Record<string, unknown> | undefined =
      jsonSchema !== undefined ? { responseMimeType: "application/json", responseSchema: jsonSchema } : undefined;
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ inlineData: inline }, { text: prompt }] }],
    };
    if (generationConfig !== undefined) body["generationConfig"] = generationConfig;
    const text = extractText(await this.generateContent(cred, model, body));
    if (jsonSchema === undefined) return text as unknown as T;
    const r = parseAndValidate<T>(text, jsonSchema);
    if (!r.ok) throw new GeminiApiError(`Output tidak valid terhadap schema (${r.errors}).`, 200, false);
    return r.value;
  }
}

/** Parse a `data:<mime>;base64,<data>` URL into Gemini inlineData. Returns null if not a data URL. */
function parseInlineData(ref: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(ref);
  return m === null ? null : { mimeType: m[1]!, data: m[2]! };
}
