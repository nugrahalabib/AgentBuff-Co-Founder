import type { FinancialInputs } from "../../../src/server/engine/financial/index";

/**
 * Canonical, hand-verifiable scenario:
 *   price 20.000 · HPP 8.000 · variable 2.000 → contribution 10.000 (margin 50%, gross 60%)
 *   fixed 5.000.000/mo → BEP 500 units/mo (revenue 10.000.000)
 *   capex 10.000.000 + buffer 5.000.000 → startup capital 15.000.000 (equity-funded, opening cash 0)
 *   600 units/mo, flat (compound 0%) → net profit 1.000.000/mo
 */
export function baseInputs(overrides: Partial<FinancialInputs> = {}): FinancialInputs {
  return {
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
    ...overrides,
  };
}
