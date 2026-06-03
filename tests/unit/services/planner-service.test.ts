import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { BusinessPlan } from "../../../src/server/domain/types";
import { PlannerService } from "../../../src/server/services/planner-service";
import { computeFinancials, type FinancialInputs } from "../../../src/server/engine/financial/index";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

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
  horizonMonths: 12,
};

const cannedNarrative = {
  execSummary: "Ringkasan.",
  businessDesc: "Deskripsi.",
  marketAnalysis: "Pasar.",
  marketingStrategy: "Pemasaran.",
  operations: "Operasional.",
  roadmap: "Roadmap.",
  risks: "Risiko.",
  closing: "Penutup.",
};

describe("PlannerService.generatePlan", () => {
  it("computes numbers in code and only asks the LLM for narrative (numbers injected, not generated)", async () => {
    const generateStructured = vi.fn().mockResolvedValue(cannedNarrative);
    const provider = { id: "mock", generateStructured } as unknown as LLMProvider;
    const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
    const registry = { forTask: vi.fn().mockResolvedValue({ provider, cred }) } as unknown as ProviderRegistry;

    const service = new PlannerService({
      plans: new InMemoryRepository<BusinessPlan>(),
      registry,
      idGen: () => "plan-1",
      now: () => "2026-06-04T00:00:00Z",
    });

    const plan = await service.generatePlan("u1", { projectId: "p1", inputs, researchSummary: "pasar kopi tumbuh" });

    // Numbers come from the deterministic engine, byte-for-byte.
    expect(plan.financials).toEqual(computeFinancials(inputs));
    expect(plan.financials.unitEconomics.contributionMarginPerUnit).toBe(10_000);
    expect(plan.financials.breakEven.bepUnitsPerMonth).toBe(500);

    // Narrative is the LLM's; numbers were injected into its prompt (binding), not requested from it.
    expect(plan.narrative).toEqual(cannedNarrative);
    const promptArg = generateStructured.mock.calls[0]![1] as string;
    expect(promptArg).toContain('"contributionMarginPerUnit":10000');
    expect(promptArg).toMatch(/jangan ubah/i);
    const optsArg = generateStructured.mock.calls[0]![2] as { systemPrompt?: string };
    expect(optsArg.systemPrompt).toMatch(/JANGAN mengubah/i);

    expect(plan.id).toBe("plan-1");
    expect(plan.status).toBe("complete");
  });
});

describe("PlannerService.importIntake", () => {
  it("extracts financial figures from a document via Document Understanding (§9.3.4.1)", async () => {
    const understandDocument = vi.fn().mockResolvedValue({ price: 25000, unitCost: 9000, fixedMonthly: 4_000_000, volume: 500 });
    const provider = { id: "mock", understandDocument } as unknown as LLMProvider;
    const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
    const registry = { forTask: vi.fn().mockResolvedValue({ provider, cred }) } as unknown as ProviderRegistry;
    const service = new PlannerService({ plans: new InMemoryRepository<BusinessPlan>(), registry, idGen: () => "x", now: () => "t" });

    const intake = await service.importIntake("u1", "data:application/pdf;base64,QUJD");
    expect(intake).toEqual({ price: 25000, unitCost: 9000, fixedMonthly: 4_000_000, volume: 500 });
    // Routed to the doc-understanding task and passed the data URL + import schema.
    expect((registry.forTask as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toBe("doc_understanding");
    expect(understandDocument.mock.calls[0]![1]).toContain("data:application/pdf");
  });
});
