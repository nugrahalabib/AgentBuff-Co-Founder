import { describe, expect, it } from "vitest";
import {
  calculateFinancials,
  mapToFinancialInputs,
  type CalculateFinancialsInput,
} from "../../../src/server/mcp/tools/calculate-financials";
import { computeFinancials } from "../../../src/server/engine/financial/index";

const input: CalculateFinancialsInput = {
  pricing: { unit_price: 20_000 },
  costs: { variable_cost_per_unit: 10_000, fixed_costs_monthly: 5_000_000, initial_capex: 10_000_000, working_capital: 5_000_000 },
  assumptions: { monthly_volume: 600, growth_rate_monthly: 0, horizon_months: 24, discount_rate_annual: 0.1 },
};

describe("MCP calculate_financials", () => {
  it("maps the wire schema and returns the SAME result as the engine (headless == UI)", () => {
    const viaTool = calculateFinancials(input);
    const viaEngine = computeFinancials(mapToFinancialInputs(input));
    expect(viaTool).toEqual(viaEngine);

    // Sanity against the canonical numbers: contribution 10.000 → BEP 500/mo, payback at month 15.
    expect(viaTool.unitEconomics.contributionMarginPerUnit).toBe(10_000);
    expect(viaTool.breakEven.bepUnitsPerMonth).toBe(500);
    expect(viaTool.returns.paybackPeriodMonths).toBe(15);
    expect(viaTool.capital.openingCash).toBe(0); // self-funded baseline
    expect(viaTool.returns.npv).not.toBeNull();
  });

  it("applies sane defaults (horizon 36, no discount, zero volume) when assumptions are omitted", () => {
    const out = mapToFinancialInputs({ pricing: { unit_price: 10_000 }, costs: {} });
    expect(out.horizonMonths).toBe(36);
    expect(out.volumeInitial).toBe(0);
    expect(out.discountRateAnnual).toBeUndefined();
    expect(out.variableCostsPerUnit).toEqual([]);
    expect(out.capexItems).toEqual([]);
  });

  it("propagates engine validation errors (e.g. price <= 0)", () => {
    expect(() => calculateFinancials({ pricing: { unit_price: 0 }, costs: {} })).toThrow();
  });
});
