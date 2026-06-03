import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { ResearchReport } from "../../../src/server/domain/types";
import { ResearchService } from "../../../src/server/services/research-service";
import { assembleSignals, computeValidationScore } from "../../../src/server/engine/research/index";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

const NORMALIZE = { product: "kopi spesialti", targetSegment: "pekerja kantoran", geography: "Jakarta" };
const EXTRACTION = {
  demandSignals: [{ label: "pencarian naik" }, { label: "komunitas kopi" }],
  trendDirection: "rising" as const,
  competitors: [{ name: "Kopi A" }, { name: "Kopi B" }],
  pricing: { min: 18000, median: 22000, max: 25000, currency: "IDR" },
  unitCostEstimate: 9000,
  costs: [],
  risks: [{ category: "regulatory" as const, severity: 3, description: "izin PIRT" }],
  differentiation: 0.5,
};
const SYNTHESIS = { summary: "Ringkasan.", recommendationReason: "Alasan rekomendasi.", resources: [{ label: "KUR", url: "https://kur.id" }] };

/** A provider mock that answers each structured call by inspecting which schema it was given. */
function makeWorld(opts?: { grounded?: boolean }) {
  const grounded = opts?.grounded ?? true;
  const groundedSearch = vi.fn().mockResolvedValue({
    text: "Pasar kopi tumbuh; harga 18.000–25.000.",
    citations: grounded ? [{ startIndex: 0, endIndex: 10, sourceUrl: "https://example.id/kopi", confidence: "grounded" }] : [],
    sources: grounded ? [{ url: "https://example.id/kopi", title: "Riset Kopi" }] : [],
  });
  const generateStructured = vi.fn().mockImplementation(async (_c: unknown, _p: string, o: { jsonSchema: { properties?: Record<string, unknown> } }) => {
    const props = o.jsonSchema.properties ?? {};
    if ("product" in props) return NORMALIZE;
    if ("demandSignals" in props) return EXTRACTION;
    return SYNTHESIS;
  });
  const provider = { id: "mock", groundedSearch, generateStructured } as unknown as LLMProvider;
  const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
  const registry = { forTask: vi.fn().mockResolvedValue({ provider, cred }) } as unknown as ProviderRegistry;
  return { registry, groundedSearch, generateStructured };
}

const expectedScore = () =>
  computeValidationScore(
    assembleSignals({
      demandSignalCount: 2,
      trend: "rising",
      priceMedian: 22000,
      costEstimate: 9000,
      competitorCount: 2,
      differentiation: 0.5,
      risks: [{ category: "regulatory", severity: 3 }],
    }),
  );

describe("ResearchService.validateIdea (multi-stage pipeline)", () => {
  it("runs stages 0–6, grounds facts, and computes the score deterministically in code", async () => {
    const { registry, groundedSearch, generateStructured } = makeWorld();
    const reports = new InMemoryRepository<ResearchReport>();
    const service = new ResearchService({ reports, registry, idGen: () => "rep-1", now: () => "2026-06-04T00:00:00Z" });

    const events: string[] = [];
    const report = await service.validateIdea("u1", {
      projectId: "p1",
      ideaText: "kedai kopi spesialti",
      market: "Jakarta",
      onStage: (p) => events.push(`${p.stage}:${p.status}`),
    });

    // Score is exactly what the deterministic engine derives from the grounded structured facts.
    const expected = expectedScore();
    expect(report.validationScore).toBe(expected.score);
    expect(report.recommendation).toBe(expected.recommendation);
    expect(report.scoreBreakdown).toEqual(expected.breakdown);

    // Structured stage outputs are persisted.
    expect(report.competitors).toHaveLength(2);
    expect(report.pricing?.median).toBe(22000);
    expect(report.market?.trendDirection).toBe("rising");
    expect(report.risks?.[0]?.category).toBe("regulatory");
    expect(report.resources?.[0]?.url).toBe("https://kur.id");
    expect(report.sourcePath).toBe("custom_pipeline");
    expect(report.recommendationReason).toBe("Alasan rekomendasi.");

    // 4 grounded queries (stages 1–4); citations carried through; sources deduped.
    expect(groundedSearch).toHaveBeenCalledTimes(4);
    expect(generateStructured).toHaveBeenCalledTimes(3); // normalize, extraction, synthesis
    expect(report.citations).toHaveLength(4);
    expect(report.sources).toHaveLength(1);
    expect(report.isGrounded).toBe(true);
    expect(report.groundingQueryCount).toBe(4);

    // Meaningful stepper events were emitted.
    expect(events).toContain("normalize:start");
    expect(events).toContain("score:done");
    expect(events).toContain("synthesis:done");

    expect(await reports.get("rep-1")).not.toBeNull();
  });

  it("marks the report ungrounded when no citations are returned", async () => {
    const { registry } = makeWorld({ grounded: false });
    const service = new ResearchService({
      reports: new InMemoryRepository<ResearchReport>(),
      registry,
      idGen: () => "rep-2",
      now: () => "t",
    });
    const report = await service.validateIdea("u1", { projectId: "p1", ideaText: "ide niche" });
    expect(report.isGrounded).toBe(false);
    expect(report.groundingQueryCount).toBe(4); // queries ran, just no citations
  });

  it("degrades gracefully when a grounded stage throws (partial results, still scores)", async () => {
    const { registry, groundedSearch } = makeWorld();
    groundedSearch.mockRejectedValueOnce(new Error("429 quota")); // first grounded stage fails
    const service = new ResearchService({
      reports: new InMemoryRepository<ResearchReport>(),
      registry,
      idGen: () => "rep-3",
      now: () => "t",
    });
    const report = await service.validateIdea("u1", { projectId: "p1", ideaText: "ide" });
    expect(report.status).toBe("completed");
    expect(report.groundingQueryCount).toBe(3); // one stage failed
    expect(report.validationScore).toBe(expectedScore().score); // extraction still produced facts
  });
});
