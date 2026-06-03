import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeminiAdapter,
  GeminiApiError,
  classifyValidationStatus,
  groundingToCitations,
  mapThinkingLevel,
} from "../../../src/lib/ai/gemini-adapter";
import { resolveModel } from "../../../src/lib/ai/model-routing";
import type { Credential } from "../../../src/lib/ai/types";

const cred: Credential = { provider: "gemini", type: "api_key", secret: "AIza-TEST-KEY" };

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

/** Read the request body of the Nth fetch call as JSON. */
function requestBody(fn: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  const init = fn.mock.calls[call]![1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}
function requestHeaders(fn: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const init = fn.mock.calls[call]![1] as RequestInit;
  return init.headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GeminiAdapter.validateCredential", () => {
  it("returns ok + full capabilities on 200, sending the key as x-goog-api-key", async () => {
    const fn = stubFetch(fakeResponse(200, { models: [] }));
    const result = await new GeminiAdapter().validateCredential(cred);

    expect(result.ok).toBe(true);
    expect(result.capabilities.groundedSearch).toBe(true);
    expect(fn.mock.calls[0]![0]).toBe("https://generativelanguage.googleapis.com/v1beta/models");
    expect(requestHeaders(fn)["x-goog-api-key"]).toBe(cred.secret);
  });

  it("treats 429 as a valid-but-limited key", async () => {
    stubFetch(fakeResponse(429, {}));
    expect((await new GeminiAdapter().validateCredential(cred)).ok).toBe(true);
  });

  it("rejects on 401 with disabled capabilities", async () => {
    stubFetch(fakeResponse(401, {}));
    const result = await new GeminiAdapter().validateCredential(cred);
    expect(result.ok).toBe(false);
    expect(result.capabilities.groundedSearch).toBe(false);
    expect(result.detail).toMatch(/ditolak/i);
  });

  it("throws a transient error on 503", async () => {
    stubFetch(fakeResponse(503, {}));
    await expect(new GeminiAdapter().validateCredential(cred)).rejects.toBeInstanceOf(GeminiApiError);
  });
});

describe("GeminiAdapter.generateStructured", () => {
  it("requests JSON-schema output and parses the structured result", async () => {
    const fn = stubFetch(
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: '{"a":1,"b":"x"}' }] } }] }),
    );
    const schema = { type: "object", properties: { a: { type: "number" } } };
    const out = await new GeminiAdapter().generateStructured(cred, "prompt", {
      jsonSchema: schema,
      reasoning: "high",
      systemPrompt: "You are an analyst.",
    });

    expect(out).toEqual({ a: 1, b: "x" });

    const url = fn.mock.calls[0]![0] as string;
    expect(url).toContain(`/models/${resolveModel("reasoning_heavy", "gemini")}:generateContent`);

    const body = requestBody(fn);
    const cfg = body["generationConfig"] as Record<string, unknown>;
    expect(cfg["responseMimeType"]).toBe("application/json");
    expect(cfg["responseSchema"]).toEqual(schema);
    expect(cfg["thinkingConfig"]).toEqual({ thinkingLevel: "high" });
    expect(body["systemInstruction"]).toEqual({ parts: [{ text: "You are an analyst." }] });
  });

  it("throws when the model returns no candidates", async () => {
    stubFetch(fakeResponse(200, { candidates: [] }));
    await expect(
      new GeminiAdapter().generateStructured(cred, "p", { jsonSchema: {} }),
    ).rejects.toBeInstanceOf(GeminiApiError);
  });

  it("returns the repaired output when the first attempt is invalid but the second is valid", async () => {
    stubFetch(
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }),
    );
    const out = await new GeminiAdapter().generateStructured(cred, "p", { jsonSchema: { type: "object" } });
    expect(out).toEqual({ a: 1 });
  });

  it("throws after one repair attempt if the output is still invalid", async () => {
    stubFetch(
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: "still not json" }] } }] }),
    );
    await expect(new GeminiAdapter().generateStructured(cred, "p", { jsonSchema: { type: "object" } })).rejects.toThrow(
      /tidak valid terhadap schema/i,
    );
  });

  it("rejects output that violates the schema (additionalProperties:false)", async () => {
    const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    stubFetch(
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: '{"a":1,"x":2}' }] } }] }),
      fakeResponse(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }),
    );
    const out = await new GeminiAdapter().generateStructured(cred, "p", { jsonSchema: schema });
    expect(out).toEqual({ a: 1 }); // first (extra prop) rejected, repaired second accepted
  });
});

describe("GeminiAdapter.groundedSearch", () => {
  it("enables google_search and normalizes citations + sources", async () => {
    const fn = stubFetch(
      fakeResponse(200, {
        candidates: [
          {
            content: { parts: [{ text: "Spain won Euro 2024." }] },
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://uefa.com", title: "uefa.com" } },
                { web: { uri: "https://aljazeera.com", title: "aljazeera.com" } },
              ],
              groundingSupports: [
                { segment: { startIndex: 0, endIndex: 20, text: "Spain won Euro 2024." }, groundingChunkIndices: [0, 1] },
              ],
            },
          },
        ],
      }),
    );

    const result = await new GeminiAdapter().groundedSearch(cred, "Who won Euro 2024?");
    expect(result.text).toBe("Spain won Euro 2024.");
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]!.sourceUrl).toBe("https://uefa.com");
    expect(result.citations[0]!.confidence).toBe("grounded");
    expect(result.sources.map((s) => s.url)).toEqual(["https://uefa.com", "https://aljazeera.com"]);

    expect(requestBody(fn)["tools"]).toEqual([{ google_search: {} }]);
  });
});

describe("pure helpers", () => {
  it("mapThinkingLevel collapses to Gemini 3 levels", () => {
    expect(mapThinkingLevel("minimal")).toBe("low");
    expect(mapThinkingLevel("low")).toBe("low");
    expect(mapThinkingLevel("medium")).toBe("high");
    expect(mapThinkingLevel("high")).toBe("high");
  });

  it("classifyValidationStatus maps HTTP codes to liveness outcomes", () => {
    expect(classifyValidationStatus(200).kind).toBe("ok");
    expect(classifyValidationStatus(429).kind).toBe("ok");
    expect(classifyValidationStatus(401).kind).toBe("rejected");
    expect(classifyValidationStatus(400).kind).toBe("rejected");
    expect(classifyValidationStatus(403).kind).toBe("rejected");
    expect(classifyValidationStatus(500).kind).toBe("transient");
  });

  it("groundingToCitations maps supports→chunks, skips missing URIs, and dedupes sources", () => {
    const meta = {
      groundingChunks: [
        { web: { uri: "https://a.com", title: "A" } },
        { web: { uri: "https://b.com" } }, // no title
        { web: {} }, // no uri → skipped
        { web: { uri: "https://a.com", title: "A again" } }, // duplicate uri
      ],
      groundingSupports: [
        { segment: { startIndex: 0, endIndex: 5, text: "hello" }, groundingChunkIndices: [0, 1, 2] },
        { segment: { startIndex: 6, endIndex: 11, text: "world" }, groundingChunkIndices: [3] },
        { groundingChunkIndices: [0] }, // no segment → skipped
      ],
    };
    const { citations, sources } = groundingToCitations(meta);

    expect(citations).toHaveLength(3); // (0,1) from first support, (3) from second; index 2 has no uri
    expect(citations[0]).toMatchObject({ sourceUrl: "https://a.com", sourceTitle: "A", claimText: "hello" });
    expect(citations[1]!.sourceTitle).toBeUndefined();
    expect(citations[2]).toMatchObject({ sourceUrl: "https://a.com", startIndex: 6, endIndex: 11 });

    expect(sources).toHaveLength(2); // a.com deduped, b.com; the uri-less chunk skipped
    expect(sources.map((s) => s.url)).toEqual(["https://a.com", "https://b.com"]);

    expect(groundingToCitations(undefined).citations).toHaveLength(0);
  });
});
