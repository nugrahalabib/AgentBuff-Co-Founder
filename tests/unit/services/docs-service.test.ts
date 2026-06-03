import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { BusinessDocument, BusinessPlan, Project, ProjectState } from "../../../src/server/domain/types";
import { DocsService, DocsInputError, boundFromFinancials } from "../../../src/server/services/docs-service";
import { computeFinancials, type FinancialInputs } from "../../../src/server/engine/financial/index";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

const INPUTS: FinancialInputs = {
  modelType: "physical",
  price: 20000,
  cogsItems: [{ label: "bahan", amount: 8000 }],
  variableCostsPerUnit: [],
  fixedCostsMonthly: [{ label: "sewa", amount: 5_000_000 }],
  capexItems: [{ label: "alat", amount: 10_000_000 }],
  workingCapitalBuffer: 5_000_000,
  volumeInitial: 600,
  growth: { type: "compound", ratePerMonth: 0 },
  funding: { equity: 15_000_000 },
  horizonMonths: 12,
};

const PROPOSAL_SLOTS = {
  tagline: "t", problem: "p", solution: "s", marketAnalysis: "m", businessModel: "bm",
  marketingPlan: "mp", team: "tm", financialHighlights: "fh", fundingAsk: "fa", closing: "c",
};
const DECK_SLOTS = { slides: [{ title: "Cover", bullets: ["x"] }] };

function world(withPlan = true) {
  const project: Project = {
    id: "p1", ownerUserId: "u1", title: "Kedai Kopi", ideaText: "kopi spesialti",
    status: "branding", refs: { documentIds: [] }, createdAt: "t", updatedAt: "t",
  };
  const plan: BusinessPlan = {
    id: "plan-1", projectId: "p1", status: "complete", version: 1, inputs: INPUTS,
    financials: computeFinancials(INPUTS), stale: false, generatedAt: "t",
  };
  const state: ProjectState = withPlan ? { project, plan } : { project };
  const generateStructured = vi.fn().mockImplementation(async (_c: unknown, _p: string, o: { jsonSchema: { properties?: Record<string, unknown> } }) => {
    return "tagline" in (o.jsonSchema.properties ?? {}) ? PROPOSAL_SLOTS : DECK_SLOTS;
  });
  const provider = { id: "mock", generateStructured } as unknown as LLMProvider;
  const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
  const registry = { forTask: vi.fn().mockResolvedValue({ provider, cred }) } as unknown as ProviderRegistry;
  const documents = new InMemoryRepository<BusinessDocument>();
  const svc = new DocsService({ documents, registry, idGen: () => "doc-1", now: () => "t" });
  return { svc, state, documents, generateStructured };
}

describe("boundFromFinancials", () => {
  it("selects engine numbers (never from an LLM)", () => {
    const b = boundFromFinancials(computeFinancials(INPUTS));
    expect(b.contributionMarginPerUnit).toBe(12000); // 20000 − 8000
    expect(b.startupCapital).toBe(15_000_000); // capex + working
    expect(typeof b.roiPct).toBe("number");
  });
});

describe("DocsService.generate", () => {
  it("generates a proposal with filled slots + bound numbers and persists it", async () => {
    const { svc, state, documents } = world();
    const doc = await svc.generate("u1", { projectState: state, type: "proposal", theme: "emerald" });
    expect(doc.type).toBe("proposal");
    expect(doc.title).toContain("Kedai Kopi");
    expect((doc.slots as typeof PROPOSAL_SLOTS).tagline).toBe("t");
    expect(doc.boundFinancials.contributionMarginPerUnit).toBe(12000);
    expect(doc.theme).toBe("emerald");
    expect(await documents.get("doc-1")).not.toBeNull();
  });

  it("generates a pitch deck", async () => {
    const { svc, state } = world();
    const doc = await svc.generate("u1", { projectState: state, type: "pitch_deck" });
    expect(doc.type).toBe("pitch_deck");
    expect((doc.slots as typeof DECK_SLOTS).slides).toHaveLength(1);
  });

  it("refuses to generate without a plan (no numbers to bind)", async () => {
    const { svc, state } = world(false);
    await expect(svc.generate("u1", { projectState: state, type: "proposal" })).rejects.toBeInstanceOf(DocsInputError);
  });
});
