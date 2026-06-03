// src/server/mcp/tools/calculate-financials.ts
// MCP tool `agentbuff.calculate_financials` (PRD §20.3, §9.6). Deterministic — NO LLM. It maps the
// simple MCP wire schema onto FinancialInputs and calls the SAME computeFinancials the UI uses, so
// headless == UI (PRD §9.6.1). This is the canonical demonstration of "Single Engine, Multi-Adapter".

import { computeFinancials, type FinancialInputs, type FinancialsResult } from "../../engine/financial/index";

/** MCP input shape (§20.3 agentbuff.calculate_financials inputSchema). */
export interface CalculateFinancialsInput {
  pricing: { unit_price: number; currency?: string };
  costs: {
    variable_cost_per_unit?: number;
    fixed_costs_monthly?: number;
    initial_capex?: number;
    working_capital?: number;
  };
  assumptions?: {
    monthly_volume?: number;
    growth_rate_monthly?: number;
    horizon_months?: number;
    discount_rate_annual?: number;
  };
}

export const CALCULATE_FINANCIALS_INPUT_SCHEMA = {
  type: "object",
  required: ["pricing", "costs"],
  properties: {
    pricing: {
      type: "object",
      required: ["unit_price"],
      properties: {
        unit_price: { type: "number" },
        currency: { type: "string", default: "IDR" },
      },
    },
    costs: {
      type: "object",
      properties: {
        variable_cost_per_unit: { type: "number" },
        fixed_costs_monthly: { type: "number" },
        initial_capex: { type: "number" },
        working_capital: { type: "number" },
      },
    },
    assumptions: {
      type: "object",
      properties: {
        monthly_volume: { type: "number" },
        growth_rate_monthly: { type: "number" },
        horizon_months: { type: "integer", default: 36 },
        discount_rate_annual: { type: "number" },
      },
    },
  },
} as const;

/** Translate the simple MCP form into full FinancialInputs (self-funded baseline; COGS folded into variable). */
export function mapToFinancialInputs(input: CalculateFinancialsInput): FinancialInputs {
  const a = input.assumptions ?? {};
  const variable = input.costs.variable_cost_per_unit ?? 0;
  const fixed = input.costs.fixed_costs_monthly ?? 0;
  const capex = input.costs.initial_capex ?? 0;
  const workingCapital = input.costs.working_capital ?? 0;

  const base: FinancialInputs = {
    modelType: "physical",
    price: input.pricing.unit_price,
    cogsItems: [],
    variableCostsPerUnit: variable > 0 ? [{ label: "variable", amount: variable }] : [],
    fixedCostsMonthly: fixed > 0 ? [{ label: "fixed", amount: fixed }] : [],
    capexItems: capex > 0 ? [{ label: "capex", amount: capex }] : [],
    workingCapitalBuffer: workingCapital,
    volumeInitial: a.monthly_volume ?? 0,
    growth: { type: "compound", ratePerMonth: a.growth_rate_monthly ?? 0 },
    // Self-funded baseline so openingCash is 0 (no spurious funding-gap warning); the full wizard
    // can override funding/loan. PRD §9.3.4.
    funding: { equity: capex + workingCapital },
    horizonMonths: a.horizon_months ?? 36,
  };
  if (a.discount_rate_annual !== undefined) base.discountRateAnnual = a.discount_rate_annual;
  return base;
}

/** Tool handler: deterministic financials from the MCP wire form. Throws FinancialInputError on bad input. */
export function calculateFinancials(input: CalculateFinancialsInput): FinancialsResult {
  return computeFinancials(mapToFinancialInputs(input));
}
