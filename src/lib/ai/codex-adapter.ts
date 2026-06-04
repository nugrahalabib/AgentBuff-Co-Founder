// src/lib/ai/codex-adapter.ts
// Codex / "Sign in with ChatGPT" serving adapter. PRD §12.16.
//
// Unlike the OpenAI API-key adapter, Codex OAuth tokens are served against the CHATGPT BACKEND
//   POST https://chatgpt.com/backend-api/codex/responses   (NOT api.openai.com)
// with Bearer <accessToken> + a `chatgpt-account-id` header + the codex `originator`/User-Agent.
// The backend FORCES stream=true & store=false and rejects most standard Responses fields — notably
// `text.format`, so Structured Outputs go through prompt-embedded JSON + our own validate/repair loop
// (the determinism guarantee still holds: code validates the JSON, the LLM never produces numbers).
//
// The wire shape is the OpenAI Responses API, so we reuse the OpenAI output parsers (extractMessage,
// annotationsToCitations) after collecting the terminal `response.completed` event from the SSE stream.

import { randomUUID } from "node:crypto";
import type { ImageOpts, LLMProvider, StructuredOpts } from "./llm-provider";
import type { Capabilities, Credential, DeepResearchHandle, GroundedResult, TaskClass } from "./types";
import { resolveModel } from "./model-routing";
import { withRetry } from "./retry";
import { parseAndValidate } from "./schema-validate";
import { annotationsToCitations, extractMessage, mapReasoningEffort } from "./openai-adapter";
import { CODEX_API_BASE, CODEX_ORIGINATOR, CODEX_USER_AGENT } from "./codex-config";

/** The shape extractMessage/annotationsToCitations consume (OAResponse is not exported, so borrow it). */
type CodexResponse = Parameters<typeof extractMessage>[0];

export class CodexApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "CodexApiError";
  }
}

const ALL_CAPS_OFF: Capabilities = {
  groundedSearch: false,
  deepResearch: false,
  imageGen: false,
  vision: false,
  docUnderstanding: false,
  docAgentCli: false,
};

// Codex (ChatGPT backend) genuinely serves text reasoning + structured JSON + web search. It does NOT
// expose api.openai.com features (Image API, background Deep Research, file_search) — gate those off so
// the registry routes them to a Gemini/OpenAI key instead. Honest capability detection (§12.14.4).
const CODEX_CAPS: Capabilities = {
  groundedSearch: true,
  deepResearch: false,
  imageGen: false,
  vision: false,
  docUnderstanding: false,
  docAgentCli: false,
};

function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced !== null ? fenced[1]! : text).trim();
}

function userInput(text: string): unknown[] {
  return [{ type: "message", role: "user", content: [{ type: "input_text", text }] }];
}

export class CodexAdapter implements LLMProvider {
  readonly id = "openai_codex";
  private readonly sessionId = randomUUID();

  private requireModel(task: TaskClass): string {
    return resolveModel(task, "openai_codex") ?? "gpt-5-codex";
  }

  /** Build a Codex-backend-legal Responses body (stream/store forced; reasoning + encrypted content). */
  private buildBody(args: {
    model: string;
    input: unknown[];
    instructions: string;
    reasoning?: StructuredOpts["reasoning"];
    tools?: unknown[];
  }): Record<string, unknown> {
    const effort = args.reasoning !== undefined ? mapReasoningEffort(args.reasoning) : "low";
    const body: Record<string, unknown> = {
      model: args.model,
      input: args.input,
      instructions: args.instructions,
      stream: true, // FORCED by the codex backend
      store: false, // FORCED
      reasoning: { effort, summary: "auto" },
      include: ["reasoning.encrypted_content"],
    };
    if (args.tools !== undefined) body["tools"] = args.tools;
    return body;
  }

  /** POST to the ChatGPT/Codex backend and reduce the SSE stream to a final Responses object. */
  private async codexResponses(cred: Credential, body: Record<string, unknown>): Promise<CodexResponse> {
    return withRetry(async () => {
      let res: Response;
      try {
        res = await fetch(CODEX_API_BASE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${cred.secret}`,
            originator: CODEX_ORIGINATOR,
            "User-Agent": CODEX_USER_AGENT,
            session_id: this.sessionId,
            ...(cred.accountId !== undefined && cred.accountId !== ""
              ? { "chatgpt-account-id": cred.accountId }
              : {}),
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new CodexApiError("Gagal menghubungi Codex (ChatGPT).", 0, true);
      }
      if (!res.ok) {
        const transient = res.status >= 500 || res.status === 429;
        const rejected = res.status === 401 || res.status === 403;
        // Drain the error body so the socket frees, but never surface raw provider text to callers.
        try {
          await res.text();
        } catch {
          /* ignore */
        }
        throw new CodexApiError(
          rejected
            ? "Token Codex/ChatGPT ditolak atau kedaluwarsa. Coba login ulang."
            : `Codex (ChatGPT) error ${res.status}.`,
          res.status,
          transient,
        );
      }
      const raw = await res.text();
      return this.reduceSse(raw);
    });
  }

  /** Collect the terminal Responses object from an SSE body (with a delta fallback). */
  private reduceSse(raw: string): CodexResponse {
    let finalResponse: CodexResponse | null = null;
    let deltaText = "";
    let errorMsg: string | null = null;

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      let evt: {
        type?: string;
        delta?: unknown;
        response?: unknown;
        error?: { message?: string } | null;
        message?: string;
      };
      try {
        evt = JSON.parse(payload) as typeof evt;
      } catch {
        continue;
      }
      const type = evt.type;
      if ((type === "response.completed" || type === "response.incomplete") && evt.response !== undefined) {
        finalResponse = evt.response as CodexResponse;
      } else if (type === "response.failed" || type === "error") {
        const fromResponse = (evt.response as { error?: { message?: string } } | undefined)?.error?.message;
        errorMsg = fromResponse ?? evt.error?.message ?? evt.message ?? "Codex gagal memproses permintaan.";
      } else if (type === "response.output_text.delta" && typeof evt.delta === "string") {
        deltaText += evt.delta;
      }
    }

    if (finalResponse !== null) return finalResponse;
    if (errorMsg !== null) {
      // Never surface raw upstream text to callers (same rule as the HTTP-error path). Keep a generic
      // Bahasa message; mark known overload/rate-limit patterns transient so withRetry can retry. (CDX-08)
      const overloaded = /overload|rate.?limit|temporarily unavailable|service_unavailable|try again|busy/i.test(errorMsg);
      throw new CodexApiError(
        overloaded ? "Codex (ChatGPT) sedang sibuk. Coba lagi sebentar." : "Codex (ChatGPT) gagal memproses permintaan.",
        200,
        overloaded,
      );
    }
    if (deltaText !== "") {
      return { output: [{ type: "message", content: [{ type: "output_text", text: deltaText }] }] } as CodexResponse;
    }
    throw new CodexApiError("Codex tidak mengembalikan keluaran.", 200, false);
  }

  async validateCredential(cred: Credential): Promise<{ ok: boolean; capabilities: Capabilities; detail?: string }> {
    try {
      await this.codexResponses(
        cred,
        this.buildBody({
          model: this.requireModel("parse_fast"),
          input: userInput("ping"),
          instructions: "Balas singkat: ok",
          reasoning: "low",
        }),
      );
      return { ok: true, capabilities: CODEX_CAPS };
    } catch (e) {
      if (e instanceof CodexApiError && e.transient) throw e;
      return {
        ok: false,
        capabilities: ALL_CAPS_OFF,
        detail: "Sesi Codex/ChatGPT ditolak atau kedaluwarsa. Coba login ulang.",
      };
    }
  }

  async generateStructured<T = unknown>(cred: Credential, prompt: string, opts: StructuredOpts): Promise<T> {
    const model = this.requireModel(opts.task ?? "reasoning_heavy");
    const schema = JSON.stringify(opts.jsonSchema);
    const instructions =
      `${opts.systemPrompt !== undefined ? opts.systemPrompt + "\n\n" : ""}` +
      `Kembalikan HANYA JSON valid yang sesuai PERSIS dengan JSON Schema berikut. ` +
      `Tanpa teks lain, tanpa penjelasan, tanpa code fence.\nJSON Schema:\n${schema}`;

    const run = async (p: string): Promise<string> =>
      extractMessage(
        await this.codexResponses(
          cred,
          this.buildBody({ model, input: userInput(p), instructions, reasoning: opts.reasoning }),
        ),
      ).text;

    const first = stripCodeFence(await run(prompt));
    const r1 = parseAndValidate<T>(first, opts.jsonSchema);
    if (r1.ok) return r1.value;

    const repair = `${prompt}\n\nCATATAN: JSON sebelumnya TIDAK valid terhadap schema (${r1.errors}). Kembalikan HANYA JSON valid persis sesuai schema.`;
    const second = stripCodeFence(await run(repair));
    const r2 = parseAndValidate<T>(second, opts.jsonSchema);
    if (r2.ok) return r2.value;
    throw new CodexApiError(`Output Codex tidak valid terhadap schema setelah perbaikan (${r2.errors}).`, 200, false);
  }

  async groundedSearch(cred: Credential, query: string, _opts?: { maxQueries?: number }): Promise<GroundedResult> {
    const data = await this.codexResponses(
      cred,
      this.buildBody({
        model: this.requireModel("grounded_light"),
        input: userInput(query),
        instructions: "Jawab ringkas dan sertakan sumber yang dapat diklik.",
        reasoning: "low",
        tools: [{ type: "web_search" }],
      }),
    );
    const { text, annotations } = extractMessage(data);
    const { citations, sources } = annotationsToCitations(annotations, text);
    return { text, citations, sources };
  }

  // --- Not available over the ChatGPT/Codex backend; capability-gated off so the registry never routes
  //     these here. Methods exist to satisfy the interface and fail honestly if forced. ---

  async runDeepResearch(): Promise<DeepResearchHandle> {
    throw new CodexApiError("Deep Research belum tersedia lewat Codex (ChatGPT). Tautkan kunci Gemini/OpenAI.", 501, false);
  }
  async pollDeepResearch(): Promise<DeepResearchHandle> {
    throw new CodexApiError("Deep Research belum tersedia lewat Codex (ChatGPT).", 501, false);
  }
  async generateImage(_cred: Credential, _prompt: string, _opts?: ImageOpts): Promise<{ imageRef: string }> {
    throw new CodexApiError("Generasi gambar belum tersedia lewat Codex (ChatGPT). Tautkan kunci Gemini/OpenAI.", 501, false);
  }
  async understandImage<T = unknown>(): Promise<T> {
    throw new CodexApiError("Vision belum tersedia lewat Codex (ChatGPT).", 501, false);
  }
  async understandDocument<T = unknown>(): Promise<T> {
    throw new CodexApiError("Baca dokumen belum tersedia lewat Codex (ChatGPT).", 501, false);
  }
}
