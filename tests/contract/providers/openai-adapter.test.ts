import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAIAdapter,
  OpenAIApiError,
  annotationsToCitations,
  classifyValidationStatus,
  extractMessage,
  mapReasoningEffort,
} from "../../../src/lib/ai/openai-adapter";
import { resolveModel } from "../../../src/lib/ai/model-routing";
import type { Credential } from "../../../src/lib/ai/types";

const cred: Credential = { provider: "openai", type: "api_key", secret: "sk-TEST-KEY" };

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}
function stubFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}
function requestBody(fn: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  const init = fn.mock.calls[call]![1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}
function requestHeaders(fn: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const init = fn.mock.calls[call]![1] as RequestInit;
  return init.headers as Record<string, string>;
}

const message = (content: unknown[]) => ({ output: [{ type: "reasoning", content: [] }, { type: "message", content }] });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenAIAdapter.validateCredential", () => {
  it("returns ok on 200 with Bearer auth; imageGen off until org-verified", async () => {
    const fn = stubFetch(fakeResponse(200, { data: [] }));
    const result = await new OpenAIAdapter().validateCredential(cred);

    expect(result.ok).toBe(true);
    expect(result.capabilities.groundedSearch).toBe(true);
    expect(result.capabilities.imageGen).toBe(false);
    expect(fn.mock.calls[0]![0]).toBe("https://api.openai.com/v1/models");
    expect(requestHeaders(fn)["Authorization"]).toBe(`Bearer ${cred.secret}`);
  });

  it("treats 429 as valid-but-limited; rejects 401; throws on 503", async () => {
    stubFetch(fakeResponse(429, {}));
    expect((await new OpenAIAdapter().validateCredential(cred)).ok).toBe(true);

    vi.unstubAllGlobals();
    stubFetch(fakeResponse(401, {}));
    const rejected = await new OpenAIAdapter().validateCredential(cred);
    expect(rejected.ok).toBe(false);
    expect(rejected.detail).toMatch(/ditolak/i);

    vi.unstubAllGlobals();
    stubFetch(fakeResponse(503, {}));
    await expect(new OpenAIAdapter().validateCredential(cred)).rejects.toBeInstanceOf(OpenAIApiError);
  });
});

describe("OpenAIAdapter.generateStructured", () => {
  it("sends a strict json_schema and parses the result", async () => {
    const fn = stubFetch(fakeResponse(200, message([{ type: "output_text", text: '{"a":1}', annotations: [] }])));
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    const out = await new OpenAIAdapter().generateStructured(cred, "prompt", {
      jsonSchema: schema,
      reasoning: "high",
      systemPrompt: "You are an analyst.",
    });

    expect(out).toEqual({ a: 1 });
    expect(fn.mock.calls[0]![0]).toBe("https://api.openai.com/v1/responses");

    const body = requestBody(fn);
    expect(body["model"]).toBe(resolveModel("reasoning_heavy", "openai"));
    expect(body["text"]).toEqual({
      format: { type: "json_schema", name: "structured_output", strict: true, schema },
    });
    expect(body["instructions"]).toBe("You are an analyst.");
    expect(body["reasoning"]).toEqual({ effort: "high" });
  });

  it("throws on a refusal", async () => {
    stubFetch(fakeResponse(200, message([{ type: "refusal", refusal: "cannot help" }])));
    await expect(new OpenAIAdapter().generateStructured(cred, "p", { jsonSchema: {} })).rejects.toThrow(
      /menolak/i,
    );
  });

  it("throws on a top-level API error", async () => {
    stubFetch(fakeResponse(200, { error: { message: "bad request" } }));
    await expect(new OpenAIAdapter().generateStructured(cred, "p", { jsonSchema: {} })).rejects.toBeInstanceOf(
      OpenAIApiError,
    );
  });

  it("repairs once when the first output is invalid, then returns the valid retry", async () => {
    stubFetch(
      fakeResponse(200, message([{ type: "output_text", text: "not json", annotations: [] }])),
      fakeResponse(200, message([{ type: "output_text", text: '{"a":1}', annotations: [] }])),
    );
    const out = await new OpenAIAdapter().generateStructured(cred, "p", { jsonSchema: { type: "object" } });
    expect(out).toEqual({ a: 1 });
  });

  it("throws after one failed repair attempt", async () => {
    stubFetch(
      fakeResponse(200, message([{ type: "output_text", text: "not json", annotations: [] }])),
      fakeResponse(200, message([{ type: "output_text", text: "still not json", annotations: [] }])),
    );
    await expect(new OpenAIAdapter().generateStructured(cred, "p", { jsonSchema: { type: "object" } })).rejects.toThrow(
      /tidak valid terhadap schema/i,
    );
  });
});

describe("OpenAIAdapter.groundedSearch", () => {
  it("enables web_search and normalizes citations from annotations", async () => {
    const fn = stubFetch(
      fakeResponse(
        200,
        message([
          {
            type: "output_text",
            text: "Spain won Euro 2024.",
            annotations: [
              { type: "url_citation", url: "https://uefa.com", title: "uefa", start_index: 0, end_index: 5 },
              { type: "url_citation", url: "https://aljazeera.com", title: "alj", start_index: 6, end_index: 20 },
            ],
          },
        ]),
      ),
    );

    const result = await new OpenAIAdapter().groundedSearch(cred, "Who won Euro 2024?");
    expect(result.text).toBe("Spain won Euro 2024.");
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]!.sourceUrl).toBe("https://uefa.com");
    expect(result.citations[0]!.claimText).toBe("Spain");
    expect(result.sources.map((s) => s.url)).toEqual(["https://uefa.com", "https://aljazeera.com"]);
    expect(requestBody(fn)["tools"]).toEqual([{ type: "web_search" }]);
  });
});

describe("pure helpers", () => {
  it("mapReasoningEffort collapses to low/medium/high", () => {
    expect(mapReasoningEffort("minimal")).toBe("low");
    expect(mapReasoningEffort("low")).toBe("low");
    expect(mapReasoningEffort("medium")).toBe("medium");
    expect(mapReasoningEffort("high")).toBe("high");
  });

  it("classifyValidationStatus maps codes", () => {
    expect(classifyValidationStatus(200).kind).toBe("ok");
    expect(classifyValidationStatus(429).kind).toBe("ok");
    expect(classifyValidationStatus(403).kind).toBe("rejected");
    expect(classifyValidationStatus(500).kind).toBe("transient");
  });

  it("extractMessage skips reasoning items and concatenates output_text", () => {
    const data = message([
      { type: "output_text", text: "hello ", annotations: [] },
      { type: "output_text", text: "world", annotations: [] },
    ]) as Parameters<typeof extractMessage>[0];
    expect(extractMessage(data).text).toBe("hello world");
  });

  it("annotationsToCitations slices claim text, dedupes sources, skips non-citations", () => {
    const text = "Spain won Euro 2024.";
    const { citations, sources } = annotationsToCitations(
      [
        { type: "url_citation", url: "https://a.com", title: "A", start_index: 0, end_index: 5 },
        { type: "file_citation" }, // not a url_citation → skipped
        { type: "url_citation", start_index: 0, end_index: 5 }, // no url → skipped
        { type: "url_citation", url: "https://a.com", title: "A2", start_index: 6, end_index: 9 }, // dup url
      ],
      text,
    );
    expect(citations).toHaveLength(2);
    expect(citations[0]!.claimText).toBe("Spain");
    expect(sources).toHaveLength(1); // a.com deduped
    expect(annotationsToCitations([{ type: "url_citation", url: "https://x.com" }]).citations[0]!.claimText).toBeUndefined();
  });
});
