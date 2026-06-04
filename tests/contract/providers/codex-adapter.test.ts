import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexAdapter, CodexApiError } from "../../../src/lib/ai/codex-adapter";
import { CODEX_API_BASE } from "../../../src/lib/ai/codex-config";
import type { Credential } from "../../../src/lib/ai/types";

const cred: Credential = {
  provider: "openai_codex",
  type: "oauth_token",
  secret: "eyJ-ACCESS-TOKEN",
  accountId: "acct_42",
};

/** Build a Responses-API SSE body terminated by a response.completed event. */
function sse(events: Array<Record<string, unknown>>): string {
  return events.map((e) => `event: ${String(e["type"])}\ndata: ${JSON.stringify(e)}\n`).join("\n") + "\n";
}
function completed(content: unknown[]): Record<string, unknown> {
  return { type: "response.completed", response: { status: "completed", output: [{ type: "message", content }] } };
}

function sseResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => ({}),
  } as unknown as Response;
}
function stubFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}
function reqBody(fn: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  return JSON.parse((fn.mock.calls[call]![1] as RequestInit).body as string) as Record<string, unknown>;
}
function reqHeaders(fn: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  return (fn.mock.calls[call]![1] as RequestInit).headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CodexAdapter targets the ChatGPT backend with codex identity headers", () => {
  it("POSTs to the codex responses endpoint with Bearer + chatgpt-account-id + originator", async () => {
    const fn = stubFetch(sseResponse(200, sse([completed([{ type: "output_text", text: '{"a":1}', annotations: [] }])])));
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    const out = await new CodexAdapter().generateStructured(cred, "prompt", { jsonSchema: schema, reasoning: "high" });

    expect(out).toEqual({ a: 1 });
    expect(fn.mock.calls[0]![0]).toBe(CODEX_API_BASE);
    const h = reqHeaders(fn);
    expect(h["Authorization"]).toBe(`Bearer ${cred.secret}`);
    expect(h["chatgpt-account-id"]).toBe("acct_42");
    expect(h["originator"]).toBe("codex_cli_rs");
    expect(h["Accept"]).toBe("text/event-stream");
  });

  it("forces stream/store and never sends text.format (codex allowlist)", async () => {
    const fn = stubFetch(sseResponse(200, sse([completed([{ type: "output_text", text: '{"a":2}', annotations: [] }])])));
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    await new CodexAdapter().generateStructured(cred, "prompt", { jsonSchema: schema });

    const body = reqBody(fn);
    expect(body["stream"]).toBe(true);
    expect(body["store"]).toBe(false);
    expect(body["text"]).toBeUndefined(); // text.format is rejected by the codex backend
    expect(body["include"]).toEqual(["reasoning.encrypted_content"]);
    expect(body["reasoning"]).toMatchObject({ summary: "auto" });
    expect(typeof body["instructions"]).toBe("string");
  });

  it("strips a ```json code fence before validating", async () => {
    const fenced = "```json\n{\"a\":3}\n```";
    const fn = stubFetch(sseResponse(200, sse([completed([{ type: "output_text", text: fenced, annotations: [] }])])));
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    expect(await new CodexAdapter().generateStructured(cred, "p", { jsonSchema: schema })).toEqual({ a: 3 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("CodexAdapter.groundedSearch", () => {
  it("sends the web_search tool and normalizes url_citation annotations", async () => {
    const annotated = [
      {
        type: "output_text",
        text: "Pasar kopi tumbuh 12%.",
        annotations: [{ type: "url_citation", url: "https://example.com/kopi", title: "Riset Kopi", start_index: 0, end_index: 21 }],
      },
    ];
    const fn = stubFetch(sseResponse(200, sse([completed(annotated)])));
    const result = await new CodexAdapter().groundedSearch(cred, "tren pasar kopi");

    expect(reqBody(fn)["tools"]).toEqual([{ type: "web_search" }]);
    expect(result.text).toBe("Pasar kopi tumbuh 12%.");
    expect(result.citations[0]).toMatchObject({ sourceUrl: "https://example.com/kopi", confidence: "grounded" });
    expect(result.sources).toEqual([{ url: "https://example.com/kopi", title: "Riset Kopi" }]);
  });
});

describe("CodexAdapter SSE reduction + validation", () => {
  it("validateCredential is ok on a completed stream", async () => {
    stubFetch(sseResponse(200, sse([completed([{ type: "output_text", text: "ok", annotations: [] }])])));
    const r = await new CodexAdapter().validateCredential(cred);
    expect(r.ok).toBe(true);
    expect(r.capabilities.groundedSearch).toBe(true);
    expect(r.capabilities.imageGen).toBe(false);
  });

  it("validateCredential rejects a 401 without throwing", async () => {
    stubFetch(sseResponse(401, ""));
    const r = await new CodexAdapter().validateCredential(cred);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/login ulang/i);
  });

  it("falls back to accumulated deltas when there is no completed event", async () => {
    const stream = sse([
      { type: "response.output_text.delta", delta: '{"a":' },
      { type: "response.output_text.delta", delta: "4}" },
    ]);
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    stubFetch(sseResponse(200, stream));
    expect(await new CodexAdapter().generateStructured(cred, "p", { jsonSchema: schema })).toEqual({ a: 4 });
  });

  it("surfaces a response.failed event as a CodexApiError", async () => {
    stubFetch(sseResponse(200, sse([{ type: "response.failed", response: { error: { message: "boom" } } }])));
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    // generateStructured wraps the first call; the failed event throws inside it.
    await expect(new CodexAdapter().generateStructured(cred, "p", { jsonSchema: schema })).rejects.toBeInstanceOf(CodexApiError);
  });

  it("deep research / image are gated off (route to a Gemini/OpenAI key instead)", async () => {
    await expect(new CodexAdapter().runDeepResearch()).rejects.toBeInstanceOf(CodexApiError);
    await expect(new CodexAdapter().generateImage(cred, "logo")).rejects.toBeInstanceOf(CodexApiError);
  });
});
