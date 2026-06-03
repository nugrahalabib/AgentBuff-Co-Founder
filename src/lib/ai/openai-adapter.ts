// src/lib/ai/openai-adapter.ts
// OpenAI adapter — implemented against the official Responses API (verified via context7, 2026-06).
//   Endpoint: POST https://api.openai.com/v1/responses, Authorization: Bearer.   §12.15
//   Structured Outputs: text.format = { type:"json_schema", name, strict:true, schema }.
//   Output: response.output[] → item type "message" → content[] of { type:"output_text", text, annotations[] }
//           or { type:"refusal", refusal }. Reasoning items are skipped.
//   Web search: tools:[{type:"web_search"}] → output_text annotations of type "url_citation"
//               ({ url, title, start_index, end_index }) → normalized to the shared Citation type.
//   Key validation: GET /v1/models. Reasoning depth: reasoning.effort. System prompt: top-level `instructions`.
// REST via fetch (no SDK). Decrypt the key in-memory per call; never log it. Deep Research / image are later phases.

import type { LLMProvider, StructuredOpts, ImageOpts } from "./llm-provider";
import type { Capabilities, Citation, Credential, DeepResearchHandle, GroundedResult, TaskClass } from "./types";
import { resolveModel } from "./model-routing";

const OPENAI_BASE = "https://api.openai.com/v1";

export class OpenAIApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "OpenAIApiError";
  }
}

interface OAAnnotation {
  type: string;
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}
interface OAContent {
  type: string;
  text?: string;
  refusal?: string;
  annotations?: OAAnnotation[];
}
interface OAOutputItem {
  type: string;
  content?: OAContent[];
}
interface OAResponse {
  output?: OAOutputItem[];
  error?: { message?: string } | null;
}

/** Map the PAL reasoning levels onto Responses API `reasoning.effort`. */
export function mapReasoningEffort(reasoning: NonNullable<StructuredOpts["reasoning"]>): "low" | "medium" | "high" {
  if (reasoning === "minimal" || reasoning === "low") return "low";
  if (reasoning === "medium") return "medium";
  return "high";
}

/** Classify a key-validation HTTP status into the PAL liveness outcome. PRD §9.1.4. */
export function classifyValidationStatus(status: number):
  | { kind: "ok" }
  | { kind: "rejected"; detail: string }
  | { kind: "transient"; detail: string } {
  if (status >= 200 && status < 300) return { kind: "ok" };
  if (status === 429) return { kind: "ok" };
  if (status === 400 || status === 401 || status === 403) {
    return { kind: "rejected", detail: "Kredensial ditolak. Periksa kembali API key OpenAI-mu." };
  }
  return { kind: "transient", detail: "Layanan OpenAI sedang bermasalah. Coba lagi sebentar." };
}

/** Concatenate assistant text and collect annotations across message items; throw on a refusal. */
export function extractMessage(data: OAResponse): { text: string; annotations: OAAnnotation[] } {
  let text = "";
  const annotations: OAAnnotation[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        throw new OpenAIApiError(`Model menolak permintaan: ${content.refusal ?? ""}`.trim(), 200, false);
      }
      if (content.type === "output_text") {
        text += content.text ?? "";
        for (const annotation of content.annotations ?? []) annotations.push(annotation);
      }
    }
  }
  return { text: text.trim(), annotations };
}

/** Normalize OpenAI `url_citation` annotations into clickable Citations + a unique source list. PRD §12.9, §12.15. */
export function annotationsToCitations(
  annotations: OAAnnotation[],
  text?: string,
): { citations: Citation[]; sources: { url: string; title?: string }[] } {
  const citations: Citation[] = [];
  const seen = new Set<string>();
  const sources: { url: string; title?: string }[] = [];
  for (const annotation of annotations) {
    if (annotation.type !== "url_citation" || annotation.url === undefined) continue;
    const startIndex = annotation.start_index ?? 0;
    const endIndex = annotation.end_index ?? 0;
    citations.push({
      claimText: text === undefined ? undefined : text.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      sourceUrl: annotation.url,
      sourceTitle: annotation.title,
      confidence: "grounded",
    });
    if (!seen.has(annotation.url)) {
      seen.add(annotation.url);
      sources.push({ url: annotation.url, title: annotation.title });
    }
  }
  return { citations, sources };
}

function requireModel(task: TaskClass): string {
  const model = resolveModel(task, "openai");
  if (model === undefined) {
    throw new OpenAIApiError(`Tidak ada model OpenAI terkonfigurasi untuk task "${task}".`, 0, false);
  }
  return model;
}

export class OpenAIAdapter implements LLMProvider {
  readonly id = "openai";

  private async responses(cred: Credential, body: Record<string, unknown>): Promise<OAResponse> {
    let res: Response;
    try {
      res = await fetch(`${OPENAI_BASE}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cred.secret}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new OpenAIApiError("Gagal menghubungi OpenAI API.", 0, true);
    }
    if (!res.ok) {
      const c = classifyValidationStatus(res.status);
      const detail = c.kind === "ok" ? "" : c.detail;
      throw new OpenAIApiError(detail || `OpenAI API error ${res.status}.`, res.status, res.status >= 500 || res.status === 429);
    }
    const data = (await res.json()) as OAResponse;
    if (data.error !== null && data.error !== undefined) {
      throw new OpenAIApiError(data.error.message ?? "OpenAI mengembalikan error.", 200, false);
    }
    return data;
  }

  async validateCredential(
    cred: Credential,
  ): Promise<{ ok: boolean; capabilities: Capabilities; detail?: string }> {
    let res: Response;
    try {
      res = await fetch(`${OPENAI_BASE}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${cred.secret}` },
      });
    } catch {
      throw new OpenAIApiError("Gagal menghubungi OpenAI API.", 0, true);
    }

    const outcome = classifyValidationStatus(res.status);
    const capabilities: Capabilities = {
      groundedSearch: true,
      deepResearch: true,
      // GPT Image requires API Organization Verification; assume off until proven. PRD §12.14.4, §12.15.
      imageGen: false,
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
    throw new OpenAIApiError(outcome.detail, res.status, true);
  }

  async generateStructured<T = unknown>(cred: Credential, prompt: string, opts: StructuredOpts): Promise<T> {
    const model = requireModel(opts.task ?? "reasoning_heavy");
    const body: Record<string, unknown> = {
      model,
      input: prompt,
      text: { format: { type: "json_schema", name: "structured_output", strict: true, schema: opts.jsonSchema } },
    };
    if (opts.systemPrompt !== undefined) body["instructions"] = opts.systemPrompt;
    if (opts.reasoning !== undefined) body["reasoning"] = { effort: mapReasoningEffort(opts.reasoning) };

    const data = await this.responses(cred, body);
    const { text } = extractMessage(data);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new OpenAIApiError("Output OpenAI bukan JSON yang valid untuk schema yang diminta.", 200, false);
    }
  }

  async groundedSearch(
    cred: Credential,
    query: string,
    _opts?: { maxQueries?: number },
  ): Promise<GroundedResult> {
    const model = requireModel("grounded_light");
    const data = await this.responses(cred, { model, input: query, tools: [{ type: "web_search" }] });
    const { text, annotations } = extractMessage(data);
    const { citations, sources } = annotationsToCitations(annotations, text);
    return { text, citations, sources };
  }

  // --- Later milestones. Verify shapes before implementing. ---

  async runDeepResearch(_cred: Credential, _brief: string, _opts?: { max?: boolean }): Promise<DeepResearchHandle> {
    // o3-deep-research / o4-mini-deep-research, background=true, >=1 data source. PRD §12.15. Fase 1.
    throw new OpenAIApiError("Deep Research (o3-deep-research) belum diimplementasikan (Fase 1).", 501, false);
  }
  async pollDeepResearch(_cred: Credential, _handle: DeepResearchHandle): Promise<DeepResearchHandle> {
    throw new OpenAIApiError("Deep Research polling belum diimplementasikan (Fase 1).", 501, false);
  }
  async generateImage(_cred: Credential, _prompt: string, _opts?: ImageOpts): Promise<{ imageRef: string }> {
    // gpt-image (needs Org Verification) → object storage. PRD §9.4, §12.15. Fase 2.
    throw new OpenAIApiError("Generasi gambar (gpt-image) belum diimplementasikan (Fase 2).", 501, false);
  }
  async understandImage<T = unknown>(
    _cred: Credential,
    _imageRef: string,
    _prompt: string,
    _jsonSchema?: object,
  ): Promise<T> {
    throw new OpenAIApiError("Vision/OCR belum diimplementasikan (Fase 2).", 501, false);
  }
  async understandDocument<T = unknown>(_cred: Credential, _fileRef: string, _jsonSchema: object): Promise<T> {
    // input_file / file_search + vector store. PRD §9.3.4.1, §12.15. Fase 1.
    throw new OpenAIApiError("Document Understanding belum diimplementasikan (Fase 1).", 501, false);
  }
}
