import { describe, expect, it, vi } from "vitest";
import { buildToolRegistry } from "../../../src/server/mcp/build-registry";
import type { McpContext } from "../../../src/server/mcp/types";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { BrandKit, BusinessDocument, BusinessPlan, Project, ResearchReport } from "../../../src/server/domain/types";
import { ProjectService } from "../../../src/server/services/project-service";
import { ResearchService } from "../../../src/server/services/research-service";
import { PlannerService } from "../../../src/server/services/planner-service";
import { BrandService } from "../../../src/server/services/brand-service";
import { DocsService } from "../../../src/server/services/docs-service";
import { assembleSignals, computeValidationScore } from "../../../src/server/engine/research/index";
import type { FinancialInputs } from "../../../src/server/engine/financial/index";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

// Stage outputs returned by the mocked provider, selected by which schema each call presents.
const NORMALIZE = { product: "Kopi spesialti", targetSegment: "pekerja", geography: "Jakarta" };
const EXTRACTION = {
  demandSignals: [{ label: "tren naik" }],
  trendDirection: "rising" as const,
  competitors: [{ name: "Kompetitor X" }],
  pricing: { min: 18000, median: 20000, max: 24000, currency: "IDR" },
  unitCostEstimate: 8000,
  costs: [],
  risks: [],
  differentiation: 0.5,
};
const SYNTHESIS = { summary: "ringkasan", recommendationReason: "alasan", resources: [] };
const PLAN_NARRATIVE = {
  execSummary: "e", businessDesc: "b", marketAnalysis: "m", marketingStrategy: "ms",
  operations: "o", roadmap: "rd", risks: "rk", closing: "c",
};
const PROPOSAL_SLOTS = {
  tagline: "t", problem: "p", solution: "s", marketAnalysis: "m", businessModel: "bm",
  marketingPlan: "mp", team: "tm", financialHighlights: "fh", fundingAsk: "fa", closing: "c",
};
const DECK_SLOTS = { slides: [{ title: "Cover", bullets: ["a", "b"] }] };
const BRAND_DIRECTION = {
  strategy: { essence: "e", positioning: "po", personality: ["ramah"], pillars: ["kualitas"] },
  selectedName: "KopiKita",
  naming: [{ name: "KopiKita", rationale: "r" }],
  voice: { attributes: ["hangat"], taglines: ["Ngopi, yuk"], samples: ["s"], dos: ["d"], donts: ["x"] },
  primaryColor: "#6366f1",
  scheme: "complementary",
  typography: { heading: "Poppins", body: "Inter" },
  logoDirection: "minimalis",
  imageryStyle: "hangat",
};
/** The deterministic score the engine derives from EXTRACTION (LLM never returns the score). */
const EXPECTED_SCORE = computeValidationScore(
  assembleSignals({ demandSignalCount: 1, trend: "rising", priceMedian: 20000, costEstimate: 8000, competitorCount: 1, differentiation: 0.5, risks: [] }),
).score;

const inputs: FinancialInputs = {
  modelType: "physical",
  price: 20_000,
  cogsItems: [{ label: "bahan", amount: 8_000 }],
  variableCostsPerUnit: [{ label: "ongkir", amount: 2_000 }],
  fixedCostsMonthly: [{ label: "sewa", amount: 5_000_000 }],
  capexItems: [{ label: "alat", amount: 10_000_000 }],
  workingCapitalBuffer: 5_000_000,
  volumeInitial: 600,
  growth: { type: "compound", ratePerMonth: 0 },
  funding: { equity: 15_000_000 },
  horizonMonths: 24,
};

function makeWorld() {
  const projectsRepo = new InMemoryRepository<Project>();
  const researchRepo = new InMemoryRepository<ResearchReport>();
  const plansRepo = new InMemoryRepository<BusinessPlan>();
  const brandRepo = new InMemoryRepository<BrandKit>();
  const documentsRepo = new InMemoryRepository<BusinessDocument>();
  let pid = 0;
  let rid = 0;
  let plid = 0;
  let bid = 0;
  let did = 0;
  let nowSeq = 0;

  const projects = new ProjectService({
    projects: projectsRepo,
    research: researchRepo,
    plans: plansRepo,
    brandKits: brandRepo,
    documents: documentsRepo,
    idGen: () => `proj-${++pid}`,
    now: () => `t-${++nowSeq}`,
  });

  const provider = {
    id: "mock",
    groundedSearch: vi.fn().mockResolvedValue({
      text: "bukti riset",
      citations: [{ startIndex: 0, endIndex: 2, sourceUrl: "https://s.id", confidence: "grounded" }],
      sources: [{ url: "https://s.id", title: "Sumber" }],
    }),
    generateStructured: vi.fn().mockImplementation(async (_c: unknown, _p: string, o: { jsonSchema: { properties?: Record<string, unknown> } }) => {
      const props = o.jsonSchema.properties ?? {};
      if ("product" in props) return NORMALIZE;
      if ("demandSignals" in props) return EXTRACTION;
      if ("recommendationReason" in props) return SYNTHESIS;
      if ("primaryColor" in props) return BRAND_DIRECTION;
      if ("tagline" in props) return PROPOSAL_SLOTS;
      if ("slides" in props) return DECK_SLOTS;
      return PLAN_NARRATIVE; // plan narrative schema
    }),
  } as unknown as LLMProvider;
  const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
  const registry = { forTask: vi.fn().mockResolvedValue({ provider, cred }) } as unknown as ProviderRegistry;

  const research = new ResearchService({ reports: researchRepo, registry, idGen: () => `rep-${++rid}`, now: () => `t-${++nowSeq}` });
  const planner = new PlannerService({ plans: plansRepo, registry, idGen: () => `plan-${++plid}`, now: () => `t-${++nowSeq}` });
  const brand = new BrandService({ brandKits: brandRepo, registry, idGen: () => `brand-${++bid}`, now: () => `t-${++nowSeq}` });
  const docs = new DocsService({ documents: documentsRepo, registry, idGen: () => `doc-${++did}`, now: () => `t-${++nowSeq}` });

  const tools = buildToolRegistry();
  const ctxFor = (userId: string): McpContext => ({ userId, projects, research, planner, brand, docs });
  return { tools, ctxFor };
}

describe("MCP tool catalog", () => {
  it("advertises the core tools", () => {
    const { tools } = makeWorld();
    const names = tools.list().map((t) => t.name);
    expect(names).toEqual([
      "agentbuff.create_project",
      "agentbuff.list_projects",
      "agentbuff.get_project",
      "agentbuff.calculate_financials",
      "agentbuff.compute_scenarios",
      "agentbuff.validate_idea",
      "agentbuff.generate_brand_kit",
      "agentbuff.generate_document",
      "agentbuff.generate_business_plan",
    ]);
  });

  it("compute_scenarios returns three deterministic KPI sets, ordered by ROI", async () => {
    const { tools, ctxFor } = makeWorld();
    const res = (await tools.call(
      "agentbuff.compute_scenarios",
      { pricing: { unit_price: 20_000 }, costs: { variable_cost_per_unit: 10_000, fixed_costs_monthly: 5_000_000 }, assumptions: { monthly_volume: 600 } },
      ctxFor("u1"),
    )) as Record<"pessimistic" | "realistic" | "optimistic", { label: string; roiPct: number }>;
    expect(res.realistic.label).toBe("Realistis");
    expect(res.pessimistic.roiPct).toBeLessThanOrEqual(res.optimistic.roiPct);
  });

  it("runs the full build-a-business flow over the same engine the UI uses", async () => {
    const { tools, ctxFor } = makeWorld();
    const ctx = ctxFor("u1");

    const created = (await tools.call("agentbuff.create_project", { idea: "Kedai kopi spesialti" }, ctx)) as {
      project_id: string;
    };
    expect(created.project_id).toBe("proj-1");

    const listed = (await tools.call("agentbuff.list_projects", {}, ctx)) as { projects: unknown[] };
    expect(listed.projects).toHaveLength(1);

    const validated = (await tools.call("agentbuff.validate_idea", { project_id: "proj-1", market: "Jakarta" }, ctx)) as {
      validation_score: number;
      sources: { url: string }[];
    };
    expect(validated.validation_score).toBe(EXPECTED_SCORE); // deterministic, computed in code
    expect(validated.sources[0]!.url).toBe("https://s.id");

    const planned = (await tools.call(
      "agentbuff.generate_business_plan",
      { project_id: "proj-1", financial_inputs: inputs },
      ctx,
    )) as { plan_id: string; financials: { unitEconomics: { contributionMarginPerUnit: number } } };
    expect(planned.plan_id).toBe("plan-1");
    expect(planned.financials.unitEconomics.contributionMarginPerUnit).toBe(10_000); // from engine, not LLM

    const brand = (await tools.call(
      "agentbuff.generate_brand_kit",
      { project_id: "proj-1", with_images: false },
      ctx,
    )) as { brand_kit_id: string; selected_name: string; palette: { primary: string } };
    expect(brand.brand_kit_id).toBe("brand-1");
    expect(brand.selected_name).toBe("KopiKita");
    expect(brand.palette.primary).toBe("#6366f1"); // deterministic palette from the engine

    const doc = (await tools.call(
      "agentbuff.generate_document",
      { project_id: "proj-1", type: "proposal" },
      ctx,
    )) as { document_id: string; type: string; title: string };
    expect(doc.document_id).toBe("doc-1");
    expect(doc.type).toBe("proposal");

    const state = (await tools.call("agentbuff.get_project", { project_id: "proj-1" }, ctx)) as {
      research?: { id: string };
      plan?: { id: string };
      documents?: { id: string }[];
      project: { status: string };
    };
    expect(state.research?.id).toBe("rep-1");
    expect(state.plan?.id).toBe("plan-1");
    expect(state.documents?.[0]?.id).toBe("doc-1");
    expect(state.project.status).toBe("complete"); // advanced to the end of the journey
  });

  it("calculate_financials is deterministic and needs no LLM", async () => {
    const { tools, ctxFor } = makeWorld();
    const res = (await tools.call(
      "agentbuff.calculate_financials",
      { pricing: { unit_price: 20_000 }, costs: { variable_cost_per_unit: 10_000, fixed_costs_monthly: 5_000_000 } },
      ctxFor("u1"),
    )) as { unitEconomics: { contributionMarginPerUnit: number }; breakEven: { bepUnitsPerMonth: number } };
    expect(res.unitEconomics.contributionMarginPerUnit).toBe(10_000);
    expect(res.breakEven.bepUnitsPerMonth).toBe(500);
  });

  it("enforces ownership and rejects unknown tools", async () => {
    const { tools, ctxFor } = makeWorld();
    await tools.call("agentbuff.create_project", { idea: "X" }, ctxFor("u1"));

    await expect(tools.call("agentbuff.get_project", { project_id: "proj-1" }, ctxFor("u2"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(tools.call("agentbuff.get_project", { project_id: "nope" }, ctxFor("u1"))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(tools.call("agentbuff.does_not_exist", {}, ctxFor("u1"))).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
    });
  });
});
