import { describe, expect, it } from "vitest";
import { computeFinancials } from "../../../src/server/engine/financial/index";
import { baseInputs } from "./fixtures";

describe("computeFinancials — canonical scenario (12 months)", () => {
  const result = computeFinancials(baseInputs());

  it("derives unit economics", () => {
    expect(result.currency).toBe("IDR");
    expect(result.unitEconomics.hppPerUnit).toBe(8_000);
    expect(result.unitEconomics.variablePerUnit).toBe(2_000);
    expect(result.unitEconomics.contributionMarginPerUnit).toBe(10_000);
    expect(result.unitEconomics.contributionMarginPct).toBeCloseTo(0.5, 9);
    expect(result.unitEconomics.grossMarginPct).toBeCloseTo(0.6, 9);
  });

  it("computes break-even", () => {
    expect(result.breakEven.feasible).toBe(true);
    expect(result.breakEven.bepUnitsPerMonth).toBe(500);
    expect(result.breakEven.bepUnitsPerMonthRounded).toBe(500);
    expect(result.breakEven.bepRevenuePerMonth).toBe(10_000_000);
    expect(result.breakEven.bepReachedMonth).toBe(1);
  });

  it("computes capital structure", () => {
    expect(result.capital.totalCapex).toBe(10_000_000);
    expect(result.capital.workingCapitalBuffer).toBe(5_000_000);
    expect(result.capital.startupCapital).toBe(15_000_000);
    expect(result.capital.loanPrincipal).toBe(0);
    expect(result.capital.openingCash).toBe(0);
    expect(result.capital.totalInvestment).toBe(15_000_000);
  });

  it("projects each month deterministically", () => {
    expect(result.projections).toHaveLength(12);
    expect(result.projections[0]).toMatchObject({
      month: 1,
      units: 600,
      revenue: 12_000_000,
      cogs: 4_800_000,
      variableCosts: 1_200_000,
      grossProfit: 7_200_000,
      fixedCosts: 5_000_000,
      loanInterest: 0,
      loanPrincipalRepayment: 0,
      tax: 0,
      operatingProfit: 1_000_000,
      netProfit: 1_000_000,
      cashFlow: 1_000_000,
      cumulativeNetProfit: 1_000_000,
      cumulativeCash: 1_000_000,
    });
    expect(result.projections[11]!.cumulativeNetProfit).toBe(12_000_000);
    expect(result.projections[11]!.cumulativeCash).toBe(12_000_000);
  });

  it("computes returns; payback is not reached in 12 months", () => {
    expect(result.returns.totalNetProfitHorizon).toBe(12_000_000);
    expect(result.returns.roiPct).toBeCloseTo(0.8, 9);
    expect(result.returns.paybackPeriodMonths).toBeNull();
    expect(result.returns.npv).toBeNull();
    expect(result.returns.runwayMonths).toBeNull();
    expect(result.returns.irrAnnualPct).not.toBeNull();
  });

  it("flags only that payback exceeds the horizon", () => {
    expect(result.warnings.map((w) => w.code)).toEqual(["payback_exceeds_horizon"]);
  });
});

describe("computeFinancials — 24-month horizon reaches payback", () => {
  const result = computeFinancials(baseInputs({ horizonMonths: 24 }));

  it("pays back at month 15 (15.000.000 / 1.000.000 per month)", () => {
    expect(result.returns.paybackPeriodMonths).toBe(15);
    expect(result.returns.totalNetProfitHorizon).toBe(24_000_000);
    expect(result.returns.roiPct).toBeCloseTo(1.6, 9);
    expect(result.returns.irrAnnualPct!).toBeGreaterThan(0);
  });

  it("emits no warnings for a healthy plan", () => {
    expect(result.warnings).toHaveLength(0);
  });
});

describe("computeFinancials — financing", () => {
  // Omit workingCapitalBuffer to exercise the default, and fund partly via a loan.
  const result = computeFinancials(
    baseInputs({
      workingCapitalBuffer: undefined,
      funding: {
        equity: 3_000_000,
        loan: { principal: 12_000_000, annualInterestRate: 0.12, tenorMonths: 12 },
      },
      horizonMonths: 24,
    }),
  );

  it("includes loan principal in opening cash and amortizes within the tenor", () => {
    expect(result.capital.startupCapital).toBe(10_000_000); // capex 10M + buffer 0
    expect(result.capital.openingCash).toBe(5_000_000); // 3M equity + 12M loan − 10M
    expect(result.projections[0]!.loanInterest).toBe(120_000);
  });

  it("has no loan flows after the tenor ends", () => {
    expect(result.projections[12]!.loanInterest).toBe(0); // month 13 > tenor 12
    expect(result.projections[12]!.loanPrincipalRepayment).toBe(0);
    const principalRepaid = result.projections
      .slice(0, 12)
      .reduce((a, p) => a + p.loanPrincipalRepayment, 0);
    expect(Math.abs(principalRepaid - 12_000_000)).toBeLessThan(20); // within IDR rounding
  });
});

describe("computeFinancials — tax modes", () => {
  it("final_revenue taxes gross revenue", () => {
    const r = computeFinancials(baseInputs({ tax: { mode: "final_revenue", rate: 0.005 } }));
    expect(r.projections[0]!.tax).toBe(60_000); // 12.000.000 * 0.5%
    expect(r.projections[0]!.netProfit).toBe(940_000); // 1.000.000 − 60.000
  });

  it("income taxes positive pre-tax profit", () => {
    const r = computeFinancials(baseInputs({ tax: { mode: "income", rate: 0.1 } }));
    expect(r.projections[0]!.tax).toBe(100_000); // 1.000.000 * 10%
    expect(r.projections[0]!.netProfit).toBe(900_000);
  });
});

describe("computeFinancials — NPV and currency", () => {
  it("computes NPV when a discount rate is supplied", () => {
    const r = computeFinancials(baseInputs({ horizonMonths: 24, discountRateAnnual: 0.1 }));
    expect(r.returns.npv).not.toBeNull();
    expect(typeof r.returns.npv).toBe("number");
  });

  it("accepts an explicit currency", () => {
    const r = computeFinancials(baseInputs({ currency: "IDR" }));
    expect(r.currency).toBe("IDR");
  });
});

describe("computeFinancials — seasonal growth", () => {
  const result = computeFinancials(
    baseInputs({ growth: { type: "seasonal", ratePerMonth: 0, seasonalIndices: [1, 0.5] } }),
  );

  it("applies the cyclic seasonal index to monthly volume", () => {
    expect(result.projections[0]!.units).toBe(600); // index[0] = 1
    expect(result.projections[1]!.units).toBe(300); // index[1] = 0.5
    expect(result.projections[2]!.units).toBe(600); // index cycles back to 1
    expect(result.projections[1]!.revenue).toBe(6_000_000); // 300 * 20.000
  });
});

describe("computeFinancials — zero investment edge", () => {
  // No capex, no fixed costs, no funding → startup capital 0.
  const result = computeFinancials(
    baseInputs({ capexItems: [], workingCapitalBuffer: 0, fixedCostsMonthly: [], funding: { equity: 0 } }),
  );

  it("guards ROI against division by zero and yields no IRR", () => {
    expect(result.capital.startupCapital).toBe(0);
    expect(result.capital.totalInvestment).toBe(0);
    expect(result.returns.roiPct).toBe(0);
    expect(result.returns.irrAnnualPct).toBeNull(); // series has no sign change
    expect(result.returns.paybackPeriodMonths).toBe(1); // profit >= 0 from month 1
  });
});
