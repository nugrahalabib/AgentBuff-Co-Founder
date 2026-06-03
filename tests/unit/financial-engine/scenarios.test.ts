import { describe, expect, it } from "vitest";
import {
  applyScenarioAdjustment,
  computeFinancials,
  computeScenarios,
  computeScenarioSummaries,
  DEFAULT_SCENARIO_ADJUSTMENTS,
  summarizeScenario,
  type FinancialInputs,
  type FinancialsResult,
} from "../../../src/server/engine/financial/index";

const base: FinancialInputs = {
  modelType: "physical",
  price: 20000,
  cogsItems: [{ label: "bahan", amount: 8000 }],
  variableCostsPerUnit: [{ label: "komisi", amount: 2000 }],
  fixedCostsMonthly: [{ label: "sewa", amount: 5_000_000 }],
  capexItems: [{ label: "alat", amount: 10_000_000 }],
  workingCapitalBuffer: 5_000_000,
  volumeInitial: 600,
  growth: { type: "compound", ratePerMonth: 0.05 },
  funding: { equity: 15_000_000 },
  horizonMonths: 12,
};

describe("applyScenarioAdjustment", () => {
  it("realistic adjustment is a no-op (identity items + unchanged growth)", () => {
    const out = applyScenarioAdjustment(base, DEFAULT_SCENARIO_ADJUSTMENTS.realistic);
    expect(out.price).toBe(20000);
    expect(out.cogsItems).toEqual([{ label: "bahan", amount: 8000 }]);
    expect(out.fixedCostsMonthly).toEqual([{ label: "sewa", amount: 5_000_000 }]);
    expect(out.volumeInitial).toBe(600);
    expect(out.growth).toEqual({ type: "compound", ratePerMonth: 0.05 });
  });

  it("pessimistic scales volume down, costs up, growth slower", () => {
    const out = applyScenarioAdjustment(base, DEFAULT_SCENARIO_ADJUSTMENTS.pessimistic);
    expect(out.price).toBe(20000); // priceMultiplier 1
    expect(out.cogsItems[0]!.amount).toBe(8800); // ×1.1
    expect(out.variableCostsPerUnit[0]!.amount).toBe(2200); // ×1.1
    expect(out.fixedCostsMonthly[0]!.amount).toBe(5_500_000); // ×1.1
    expect(out.volumeInitial).toBe(450); // ×0.75
    expect(out.growth.ratePerMonth).toBeCloseTo(0.03, 10); // 0.05 − 0.02
  });

  it("optimistic scales volume up, variable cost down, growth faster", () => {
    const out = applyScenarioAdjustment(base, DEFAULT_SCENARIO_ADJUSTMENTS.optimistic);
    expect(out.volumeInitial).toBe(750); // ×1.25
    expect(out.cogsItems[0]!.amount).toBe(7600); // ×0.95
    expect(out.fixedCostsMonthly[0]!.amount).toBe(5_000_000); // ×1 (unchanged)
    expect(out.growth.ratePerMonth).toBeCloseTo(0.07, 10);
  });

  it("preserves a seasonal growth model's indices while shifting the rate", () => {
    const seasonal: FinancialInputs = {
      ...base,
      growth: { type: "seasonal", ratePerMonth: 0.04, seasonalIndices: [1, 1.2, 0.8] },
    };
    const out = applyScenarioAdjustment(seasonal, DEFAULT_SCENARIO_ADJUSTMENTS.pessimistic);
    expect(out.growth).toEqual({ type: "seasonal", ratePerMonth: 0.02, seasonalIndices: [1, 1.2, 0.8] });
  });
});

describe("computeScenarios", () => {
  it("realistic scenario equals the base computeFinancials exactly", () => {
    const set = computeScenarios(base);
    expect(set.realistic).toEqual(computeFinancials(base));
  });

  it("orders outcomes pessimistic ≤ realistic ≤ optimistic by ROI", () => {
    const set = computeScenarios(base);
    expect(set.pessimistic.returns.roiPct).toBeLessThanOrEqual(set.realistic.returns.roiPct);
    expect(set.realistic.returns.roiPct).toBeLessThanOrEqual(set.optimistic.returns.roiPct);
  });

  it("honors per-scenario overrides", () => {
    const set = computeScenarios(base, {
      optimistic: { label: "Custom", volumeMultiplier: 2, growthDelta: 0, variableCostMultiplier: 1, fixedCostMultiplier: 1, priceMultiplier: 1 },
    });
    // Doubling volume should beat the default optimistic case.
    expect(set.optimistic.returns.totalNetProfitHorizon).toBeGreaterThan(
      computeScenarios(base).optimistic.returns.totalNetProfitHorizon,
    );
  });
});

describe("summaries", () => {
  it("computeScenarioSummaries returns labelled KPI sets", () => {
    const s = computeScenarioSummaries(base);
    expect(s.pessimistic.label).toBe("Pesimistis");
    expect(s.realistic.label).toBe("Realistis");
    expect(s.optimistic.label).toBe("Optimistis");
    expect(typeof s.realistic.roiPct).toBe("number");
    expect(s.realistic).toHaveProperty("finalCumulativeCash");
  });

  it("summarizeScenario falls back to 0 final cash when there are no projections", () => {
    const empty = { projections: [], unitEconomics: { contributionMarginPerUnit: 0 }, breakEven: { bepUnitsPerMonthRounded: null }, returns: { paybackPeriodMonths: null, roiPct: 0, totalNetProfitHorizon: 0 } } as unknown as FinancialsResult;
    expect(summarizeScenario("X", empty).finalCumulativeCash).toBe(0);
  });
});
