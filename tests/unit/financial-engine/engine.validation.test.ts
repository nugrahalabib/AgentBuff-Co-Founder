import { describe, expect, it } from "vitest";
import {
  computeFinancials,
  FinancialInputError,
  validateInputs,
  type FinancialInputs,
} from "../../../src/server/engine/financial/index";
import { baseInputs } from "./fixtures";

const NaNv = Number.NaN;

const invalidCases: Array<[string, Partial<FinancialInputs>]> = [
  ["price is not finite", { price: NaNv }],
  ["price is not positive", { price: 0 }],
  ["a COGS item is negative", { cogsItems: [{ label: "bahan", amount: -1 }] }],
  ["a variable cost is negative", { variableCostsPerUnit: [{ label: "v", amount: -1 }] }],
  ["a fixed cost is negative", { fixedCostsMonthly: [{ label: "f", amount: -1 }] }],
  ["a capex item is negative", { capexItems: [{ label: "c", amount: -1 }] }],
  ["initial volume is negative", { volumeInitial: -1 }],
  ["initial volume is not finite", { volumeInitial: NaNv }],
  ["horizon is not an integer", { horizonMonths: 12.5 }],
  ["horizon is below 1", { horizonMonths: 0 }],
  ["horizon exceeds the cap", { horizonMonths: 601 }],
  ["working capital buffer is negative", { workingCapitalBuffer: -1 }],
  ["equity is negative", { funding: { equity: -1 } }],
  ["loan principal is negative", { funding: { equity: 0, loan: { principal: -1, annualInterestRate: 0.1, tenorMonths: 12 } } }],
  ["loan interest is negative", { funding: { equity: 0, loan: { principal: 1, annualInterestRate: -0.1, tenorMonths: 12 } } }],
  ["loan tenor is not an integer", { funding: { equity: 0, loan: { principal: 1, annualInterestRate: 0.1, tenorMonths: 12.5 } } }],
  ["loan tenor is below 1", { funding: { equity: 0, loan: { principal: 1, annualInterestRate: 0.1, tenorMonths: 0 } } }],
  ["growth rate is not finite", { growth: { type: "compound", ratePerMonth: NaNv } }],
  ["seasonal indices are empty", { growth: { type: "seasonal", ratePerMonth: 0, seasonalIndices: [] } }],
  ["a seasonal index is negative", { growth: { type: "seasonal", ratePerMonth: 0, seasonalIndices: [1, -0.5] } }],
  ["tax rate is not finite", { tax: { mode: "final_revenue", rate: NaNv } }],
  ["tax rate is below 0", { tax: { mode: "final_revenue", rate: -0.1 } }],
  ["tax rate is above 1", { tax: { mode: "final_revenue", rate: 1.5 } }],
  ["discount rate is not finite", { discountRateAnnual: NaNv }],
  ["discount rate is at or below -1", { discountRateAnnual: -1 }],
];

describe("validateInputs / computeFinancials — structural validation", () => {
  it.each(invalidCases)("throws FinancialInputError when %s", (_label, override) => {
    expect(() => computeFinancials(baseInputs(override))).toThrow(FinancialInputError);
  });

  it("accepts valid inputs without throwing", () => {
    expect(() => validateInputs(baseInputs())).not.toThrow();
    expect(validateInputs(baseInputs())).toBeUndefined();
  });

  it("throws when a projection overflows to a non-finite value", () => {
    // 600 * 6^599 exceeds Number.MAX_VALUE → Infinity; the engine refuses to emit NaN/Infinity.
    expect(() =>
      computeFinancials(baseInputs({ growth: { type: "compound", ratePerMonth: 5 }, horizonMonths: 600 })),
    ).toThrow(FinancialInputError);
  });
});
