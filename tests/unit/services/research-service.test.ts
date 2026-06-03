import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { ResearchReport } from "../../../src/server/domain/types";
import { ResearchService } from "../../../src/server/services/research-service";
import { computeValidationScore } from "../../../src/server/engine/research/index";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

const cannedSignals = {
  demandStrength: 0.8,
  marginHeadroom: 0.7,
  competitionGap: 0.6,
  differentiation: 0.5,
  summary: "Permintaan kuat, kompetisi sedang.",
};

function makeRegistry() {
  const groundedSearch = vi.fn().mockResolvedValue({
    text: "Pasar kopi tumbuh; banyak kompetitor; harga 18.000–25.000.",
    citations: [{ startIndex: 0, endIndex: 10, sourceUrl: "https://example.id/kopi", confidence: "grounded" }],
    sources: [{ url: "https://example.id/kopi", title: "Riset Kopi" }],
  });
  const generateStructured = vi.fn().mockResolvedValue(cannedSignals);
  const provider = { id: "mock", groundedSearch, generateStructured } as unknown as LLMProvider;
  const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
  const registry = { forTask: vi.fn().mockResolvedValue({ provider, cred }) } as unknown as ProviderRegistry;
  return { registry, groundedSearch, generateStructured };
}

describe("ResearchService.validateIdea", () => {
  it("lets the LLM propose signals but computes the score deterministically in code", async () => {
    const { registry, groundedSearch, generateStructured } = makeRegistry();
    const reports = new InMemoryRepository<ResearchReport>();
    const service = new ResearchService({ reports, registry, idGen: () => "rep-1", now: () => "2026-06-04T00:00:00Z" });

    const report = await service.validateIdea("u1", { projectId: "p1", ideaText: "kedai kopi spesialti", market: "Jakarta" });

    // The score is exactly what the deterministic engine produces from the LLM's signals.
    const expected = computeValidationScore(cannedSignals);
    expect(report.validationScore).toBe(expected.score);
    expect(report.recommendation).toBe(expected.recommendation);
    expect(report.scoreBreakdown).toEqual(expected.breakdown);

    // Grounded citations are carried through verbatim.
    expect(report.citations).toHaveLength(1);
    expect(report.sources[0]!.url).toBe("https://example.id/kopi");
    expect(report.isGrounded).toBe(true);

    expect(report.id).toBe("rep-1");
    expect(report.projectId).toBe("p1");
    expect(await reports.get("rep-1")).not.toBeNull();

    // It actually grounded first, then asked for structured signals.
    expect(groundedSearch).toHaveBeenCalledOnce();
    expect(generateStructured).toHaveBeenCalledOnce();
  });

  it("marks the report ungrounded when no citations are returned", async () => {
    const { registry, groundedSearch } = makeRegistry();
    groundedSearch.mockResolvedValueOnce({ text: "tidak ada sumber", citations: [], sources: [] });
    const service = new ResearchService({
      reports: new InMemoryRepository<ResearchReport>(),
      registry,
      idGen: () => "rep-2",
      now: () => "t",
    });
    const report = await service.validateIdea("u1", { projectId: "p1", ideaText: "ide niche" });
    expect(report.isGrounded).toBe(false);
  });
});
