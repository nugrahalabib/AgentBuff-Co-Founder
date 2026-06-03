import { describe, expect, it } from "vitest";
import {
  computeFinancials,
  type FinancialsResult,
} from "../../../src/server/engine/financial/index";
import { baseInputs } from "./fixtures";

const codes = (r: FinancialsResult): string[] => r.warnings.map((w) => w.code);

describe("computeFinancials — warnings", () => {
  it("price_below_cost when contribution margin is non-positive", () => {
    const r = computeFinancials(baseInputs({ price: 5_000 })); // 5.000 < 8.000 + 2.000
    expect(codes(r)).toContain("price_below_cost");
    expect(r.warnings.find((w) => w.code === "price_below_cost")!.severity).toBe("error");
    expect(r.breakEven.feasible).toBe(false);
    expect(r.breakEven.bepUnitsPerMonth).toBeNull();
    expect(r.breakEven.bepRevenuePerMonth).toBeNull();
    expect(r.breakEven.bepReachedMonth).toBeNull();
  });

  it("very_high_margin above 90% gross", () => {
    const r = computeFinancials(
      baseInputs({ price: 10_000, cogsItems: [{ label: "x", amount: 500 }], variableCostsPerUnit: [] }),
    );
    expect(codes(r)).toContain("very_high_margin"); // gross (10.000-500)/10.000 = 95%
  });

  it("zero_volume when initial volume is 0", () => {
    expect(codes(computeFinancials(baseInputs({ volumeInitial: 0 })))).toContain("zero_volume");
  });

  it("negative_growth and volume clamps at zero under decline", () => {
    const r = computeFinancials(baseInputs({ growth: { type: "linear", ratePerMonth: -0.1 } }));
    expect(codes(r)).toContain("negative_growth");
    expect(r.projections[11]!.units).toBe(0); // month 12 raw is negative → clamped
  });

  it("funding_gap when sources are below startup capital", () => {
    const r = computeFinancials(baseInputs({ funding: { equity: 10_000_000 } }));
    expect(codes(r)).toContain("funding_gap");
    expect(r.capital.openingCash).toBe(-5_000_000);
  });

  it("bep_not_reached when volume stays below break-even", () => {
    const r = computeFinancials(baseInputs({ volumeInitial: 100 })); // BEP is 500/mo
    expect(codes(r)).toContain("bep_not_reached");
    expect(r.breakEven.bepReachedMonth).toBeNull();
  });

  it("loss_making_horizon + runway + zero income tax on a loss", () => {
    const r = computeFinancials(
      baseInputs({
        fixedCostsMonthly: [{ label: "sewa", amount: 50_000_000 }],
        tax: { mode: "income", rate: 0.1 },
        capexItems: [],
        workingCapitalBuffer: 0,
        funding: { equity: 0 },
      }),
    );
    expect(codes(r)).toContain("loss_making_horizon");
    expect(r.projections[0]!.tax).toBe(0); // pre-tax profit is negative → no income tax
    expect(r.returns.runwayMonths).toBe(1); // cash goes negative immediately
  });

  it("fractional break-even is rounded for display", () => {
    const r = computeFinancials(
      baseInputs({ fixedCostsMonthly: [{ label: "sewa", amount: 5_000_000 }], variableCostsPerUnit: [{ label: "v", amount: 0 }], cogsItems: [{ label: "c", amount: 8_000 }], price: 20_000 }),
    );
    // contribution = 12.000 → BEP = 5.000.000 / 12.000 = 416,67
    expect(r.breakEven.bepUnitsPerMonth).toBe(416.67);
    expect(r.breakEven.bepUnitsPerMonthRounded).toBe(417);
  });
});
