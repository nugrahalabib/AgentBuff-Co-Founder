// src/lib/ai/openai-adapter.ts
// OpenAI adapter — implemented against the official Responses API (verified against developers.openai.com, 2026-06-04).
//   Endpoint: POST https://api.openai.com/v1/responses, Authorization: Bearer.   §12.15
//   Structured Outputs: text.format = { type:"json_schema", name, strict:true, schema }. Strict mode
//     REQUIRES additionalProperties:false + every property in required[] — we enforce that with
//     toStrictJsonSchema() so a Gemini-authored (looser) schema doesn't 400 on OpenAI.
//   Output: response.output[] → item type "message" → content[] of { type:"output_text", text, annotations[] }
//           or { type:"refusal", refusal }. Reasoning items are skipped.
//   Web search: tools:[{type:"web_search"}] → output_text annotations of type "url_citation"
//               ({ url, title, start_index, end_index }) → normalized to the shared Citation type.
//   Key validation: GET /v1/models. Reasoning depth: reasoning.effort ∈ {low,medium,high,xhigh}.
// REST via fetch (no SDK). Decrypt the key in-memory per call; never log it.

import type { LLMProvider, StructuredOpts, ImageOpts } from "./llm-provider";
import type { Capabilities, Citation, Credential, DeepResearchHandle, GroundedResult, TaskClass } from "./types";
import { resolveDeepResearchAgent, resolveModel } from "./model-routing";
import { withRetry } from "./retry";
import { parseAndValidate } from "./schema-validate";

/**
 * Coerce a JSON Schema into OpenAI strict-mode form: every object gets additionalProperties:false and
 * required = all its property keys (OpenAI strict requires this; use nullable types for "optional").
 * Idempotent on already-conformant schemas. PRD §12.15.
 */
export function toStrictJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) out[k] = toStrictJsonSchema(v);
  const props = out["properties"];
  if (out["type"] === "object" && props !== null && typeof props === "object") {
    out["additionalProperties"] = false;
    out["required"] = Object.keys(props as Record<string, unknown>);
  }
  return out;
}

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
  id?: string;
  status?: string;
  output?: OAOutputItem[];
  error?: { message?: string } | null;
}

/** Map a Responses background status onto the PAL deep-research handle status. */
function mapBgStatus(status: string | undefined): DeepResearchHandle["status"] {
  if (status === "completed" || status === "succeeded") return "completed";
  if (status === "failed" || status === "cancelled" || status === "error") return "failed";
  if (status === "queued") return "queued";
  return "running";
}

/** Map the PAL reasoning levels onto Responses API `reasoning.effort` ∈ {low,medium,high,xhigh}. §12.15 */
export function mapReasoningEffort(
  reasoning: NonNullable<StructuredOpts["reasoning"]>,
): "low" | "medium" | "high" | "xhigh" {
  if (reasoning === "minimal" || reasoning === "low") return "low";
  if (reasoning === "medium") return "medium";
  if (reasoning === "xhigh") return "xhigh";
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

/** SSRF guard: reject anything that is not an inline base64 data URL. */
function requireDataUrl(ref: string): void {
  if (!/^data:[^;]+;base64,/.test(ref)) {
    throw new OpenAIApiError("Sumber harus berupa data URL (data:<mime>;base64,...).", 400, false);
  }
}

export class OpenAIAdapter implements LLMProvider {
  readonly id = "openai";

  private async responses(cred: Credential, body: Record<string, unknown>): Promise<OAResponse> {
    // Retry transient (429/5xx/network) errors with exponential backoff. PRD §12.5.
    return withRetry(async () => {
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
    });
  }

  async validateCredential(
    cred: Credential,
  ): Promise<{ ok: boolean; capabilities: Capabilities; detail?: string }> {
    // GPT Image requires API Organization Verification; assume off until proven. PRD §12.14.4, §12.15.
    const fullCaps: Capabilities = {
      groundedSearch: true,
      deepResearch: true,
      imageGen: false,
      vision: true,
      docUnderstanding: true,
      docAgentCli: true,
    };
    const noCaps: Capabilities = {
      groundedSearch: false,
      deepResearch: false,
      imageGen: false,
      vision: false,
      docUnderstanding: false,
      docAgentCli: false,
    };

    // Codex / "Sign in with ChatGPT" (oauth_token): validate via a minimal Responses API call,
    // since OAuth tokens may not work against the platform models endpoint. PRD §12.16.
    if (cred.type === "oauth_token") {
      try {
        await this.responses(cred, { model: requireModel("parse_fast"), input: "ping", max_output_tokens: 16 });
        return { ok: true, capabilities: fullCaps };
      } catch (e) {
        if (e instanceof OpenAIApiError && e.transient) throw e;
        return { ok: false, capabilities: noCaps, detail: "Token Codex/ChatGPT ditolak atau tidak kompatibel dengan API ini." };
      }
    }

    // API key: cheap models-list probe.
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
    if (outcome.kind === "ok") return { ok: true, capabilities: fullCaps };
    if (outcome.kind === "rejected") return { ok: false, capabilities: noCaps, detail: outcome.detail };
    throw new OpenAIApiError(outcome.detail, res.status, true);
  }

  async generateStructured<T = unknown>(cred: Credential, prompt: string, opts: StructuredOpts): Promise<T> {
    const model = requireModel(opts.task ?? "reasoning_heavy");
    const makeBody = (input: string): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        model,
        input,
        text: { format: { type: "json_schema", name: "structured_output", strict: true, schema: toStrictJsonSchema(opts.jsonSchema) } },
      };
      if (opts.systemPrompt !== undefined) body["instructions"] = opts.systemPrompt;
      if (opts.reasoning !== undefined) body["reasoning"] = { effort: mapReasoningEffort(opts.reasoning) };
      return body;
    };

    // generate → validate against JSON Schema → one repair attempt → else fail. PRD §12.5.
    const first = extractMessage(await this.responses(cred, makeBody(prompt))).text;
    const r1 = parseAndValidate<T>(first, opts.jsonSchema);
    if (r1.ok) return r1.value;

    const repairPrompt = `${prompt}\n\nCATATAN: Output JSON sebelumnya TIDAK valid terhadap schema (${r1.errors}). Kembalikan HANYA JSON valid persis sesuai schema, tanpa teks lain.`;
    const second = extractMessage(await this.responses(cred, makeBody(repairPrompt))).text;
    const r2 = parseAndValidate<T>(second, opts.jsonSchema);
    if (r2.ok) return r2.value;
    throw new OpenAIApiError(`Output OpenAI tidak valid terhadap schema setelah perbaikan (${r2.errors}).`, 200, false);
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

  async runDeepResearch(cred: Credential, brief: string, opts?: { max?: boolean }): Promise<DeepResearchHandle> {
    // Official deep-research models (o4-mini-deep-research economy / o3-deep-research quality when max=true),
    // background=true, with ≥1 data source (web_search). Returns an id to poll. §12.15.
    const model = resolveDeepResearchAgent("openai", opts?.max === true);
    if (model === undefined) {
      throw new OpenAIApiError("Tidak ada model Deep Research OpenAI terkonfigurasi.", 0, false);
    }
    const data = await this.responses(cred, { model, input: brief, background: true, tools: [{ type: "web_search" }] });
    const ref = data.id ?? "";
    return { reportId: ref, status: mapBgStatus(data.status), providerRef: ref };
  }

  async pollDeepResearch(cred: Credential, handle: DeepResearchHandle): Promise<DeepResearchHandle> {
    if (handle.providerRef === undefined || handle.providerRef === "") {
      throw new OpenAIApiError("providerRef response tidak ada untuk polling.", 400, false);
    }
    // GET /v1/responses/{id} to check status + collect output.
    const data = await withRetry(async () => {
      let res: Response;
      try {
        res = await fetch(`${OPENAI_BASE}/responses/${handle.providerRef}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${cred.secret}` },
        });
      } catch {
        throw new OpenAIApiError("Gagal menghubungi OpenAI Responses API.", 0, true);
      }
      if (!res.ok) {
        const c = classifyValidationStatus(res.status);
        throw new OpenAIApiError(c.kind === "ok" ? "" : c.detail || `Responses error ${res.status}.`, res.status, res.status >= 500 || res.status === 429);
      }
      return (await res.json()) as OAResponse;
    });
    const status = mapBgStatus(data.status);
    if (status !== "completed") return { ...handle, status };
    const { text, annotations } = extractMessage(data);
    const { citations, sources } = annotationsToCitations(annotations, text);
    return { ...handle, status, text, citations, sources };
  }
  async generateImage(cred: Credential, prompt: string, opts?: ImageOpts): Promise<{ imageRef: string }> {
    // gpt-image via the Image API → base64 → data URL. Requires Org Verification on the user's account
    // (capability-gated upstream; this surfaces a friendly error if not). PRD §9.4, §12.15.
    const model = requireModel("image_gen");
    return withRetry(async () => {
      let res: Response;
      try {
        res = await fetch(`${OPENAI_BASE}/images/generations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cred.secret}` },
          body: JSON.stringify({ model, prompt, size: opts?.size ?? "1024x1024", n: opts?.n ?? 1 }),
        });
      } catch {
        throw new OpenAIApiError("Gagal menghubungi OpenAI Image API.", 0, true);
      }
      if (!res.ok) {
        const c = classifyValidationStatus(res.status);
        const detail = c.kind === "ok" ? "" : c.detail;
        throw new OpenAIApiError(detail || `OpenAI Image API error ${res.status}.`, res.status, res.status >= 500 || res.status === 429);
      }
      const data = (await res.json()) as { data?: { b64_json?: string }[]; error?: { message?: string } | null };
      if (data.error !== null && data.error !== undefined) {
        throw new OpenAIApiError(data.error.message ?? "OpenAI mengembalikan error.", 200, false);
      }
      const b64 = data.data?.[0]?.b64_json;
      if (b64 === undefined) throw new OpenAIApiError("OpenAI tidak mengembalikan gambar.", 200, false);
      return { imageRef: `data:image/png;base64,${b64}` };
    });
  }
  async understandImage<T = unknown>(cred: Credential, imageRef: string, prompt: string, jsonSchema?: object): Promise<T> {
    // SSRF guard: only inline base64 data URLs — never forward a caller-controlled http(s) URL to the
    // provider (which would fetch it server-side). Mirrors the Gemini adapter. PRD §13.3.
    requireDataUrl(imageRef);
    const content = [
      { type: "input_text", text: prompt },
      { type: "input_image", image_url: imageRef },
    ];
    return this.understandContent<T>(cred, content, "vision", jsonSchema);
  }

  async understandDocument<T = unknown>(cred: Credential, fileRef: string, jsonSchema: object): Promise<T> {
    // input_file accepts a data URL (filename + file_data) for PDFs/images. PRD §9.3.4.1, §12.15.
    requireDataUrl(fileRef);
    const content = [
      { type: "input_text", text: "Ekstrak field terstruktur dari dokumen ini sesuai schema; jangan mengarang." },
      { type: "input_file", filename: "dokumen", file_data: fileRef },
    ];
    return this.understandContent<T>(cred, content, "doc_understanding", jsonSchema);
  }

  /** Shared vision/doc path over the Responses API with multimodal input + optional structured output. */
  private async understandContent<T>(cred: Credential, content: unknown[], task: TaskClass, jsonSchema?: object): Promise<T> {
    const model = requireModel(task);
    const body: Record<string, unknown> = { model, input: [{ role: "user", content }] };
    if (jsonSchema !== undefined) {
      body["text"] = { format: { type: "json_schema", name: "structured_output", strict: true, schema: toStrictJsonSchema(jsonSchema) } };
    }
    const { text } = extractMessage(await this.responses(cred, body));
    if (jsonSchema === undefined) return text as unknown as T;
    const r = parseAndValidate<T>(text, jsonSchema);
    if (!r.ok) throw new OpenAIApiError(`Output tidak valid terhadap schema (${r.errors}).`, 200, false);
    return r.value;
  }
}
