import { describe, expect, it, vi } from "vitest";
import { InMemoryUsageRecorder, summarize, type UsageEntry } from "../../../src/server/services/usage-recorder";
import { RecordingProviderRegistry } from "../../../src/server/ai/recording-registry";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

const entry = (over: Partial<UsageEntry>): UsageEntry => ({
  userId: "u1", operation: "structured", provider: "gemini", ts: "t", ...over,
});

describe("summarize", () => {
  it("aggregates totals, per-operation, per-provider, grounded + images", () => {
    const s = summarize([
      entry({ operation: "structured" }),
      entry({ operation: "grounded", groundedQueries: 1 }),
      entry({ operation: "grounded", groundedQueries: 1 }),
      entry({ operation: "image", provider: "openai", imagesGenerated: 1 }),
    ]);
    expect(s.total).toBe(4);
    expect(s.byOperation).toEqual({ structured: 1, grounded: 2, image: 1 });
    expect(s.byProvider).toEqual({ gemini: 3, openai: 1 });
    expect(s.groundedQueries).toBe(2);
    expect(s.imagesGenerated).toBe(1);
  });

  it("returns the most recent entries first, capped by limit", () => {
    const many = Array.from({ length: 5 }, (_, i) => entry({ model: `m${i}` }));
    const s = summarize(many, 2);
    expect(s.recent.map((e) => e.model)).toEqual(["m4", "m3"]);
  });
});

describe("InMemoryUsageRecorder", () => {
  it("records and summarizes per user", async () => {
    const rec = new InMemoryUsageRecorder();
    await rec.record(entry({ userId: "u1" }));
    await rec.record(entry({ userId: "u2" }));
    expect((await rec.summary("u1")).total).toBe(1);
    expect((await rec.summary("u2")).total).toBe(1);
    expect((await rec.summary("nobody")).total).toBe(0);
  });
});

describe("RecordingProviderRegistry", () => {
  function world() {
    const generateStructured = vi.fn().mockResolvedValue({ ok: true });
    const groundedSearch = vi.fn().mockResolvedValue({ text: "t", citations: [], sources: [] });
    const generateImage = vi.fn().mockResolvedValue({ imageRef: "data:image/png;base64,AAA" });
    const inner = { id: "gemini", generateStructured, groundedSearch, generateImage } as unknown as LLMProvider;
    const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
    const innerReg = { forTask: vi.fn().mockResolvedValue({ provider: inner, cred }) } as unknown as ProviderRegistry;
    const recorder = new InMemoryUsageRecorder();
    const reg = new RecordingProviderRegistry(innerReg, recorder, () => "t");
    return { reg, recorder, cred, generateStructured, groundedSearch };
  }

  it("delegates calls and records usage with the resolved model", async () => {
    const { reg, recorder, cred } = world();
    const { provider } = await reg.forTask("u1", "reasoning_heavy");
    await provider.generateStructured(cred, "p", { jsonSchema: {} });
    await provider.groundedSearch(cred, "q");
    await provider.generateImage(cred, "logo");

    const s = await recorder.summary("u1");
    expect(s.total).toBe(3);
    expect(s.byOperation).toEqual({ structured: 1, grounded: 1, image: 1 });
    expect(s.groundedQueries).toBe(1);
    expect(s.imagesGenerated).toBe(1);
    // The structured call records the model resolved for reasoning_heavy on gemini.
    expect(s.recent.some((e) => e.operation === "structured" && typeof e.model === "string")).toBe(true);
  });

  it("does not record when the underlying call throws", async () => {
    const { reg, recorder, cred, generateStructured } = world();
    generateStructured.mockRejectedValueOnce(new Error("boom"));
    const { provider } = await reg.forTask("u1", "reasoning_heavy");
    await expect(provider.generateStructured(cred, "p", { jsonSchema: {} })).rejects.toThrow("boom");
    expect((await recorder.summary("u1")).total).toBe(0);
  });
});
