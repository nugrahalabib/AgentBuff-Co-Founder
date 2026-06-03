// src/server/engine/financial/scenarios.ts
// Deterministic Pessimistic / Realistic / Optimistic scenarios. PRD §9.3.9 ("engine menghasilkan tiga set").
// Each scenario applies principled, documented multipliers to the base inputs and re-runs the SAME
// deterministic engine — no LLM, no randomness. Realistic === the base case exactly.

import { computeFinancials } from "./engine";
import { roundIDR } from "./money";
import type { CostItem, FinancialInputs, FinancialsResult, GrowthModel } from "./types";

export type ScenarioKey = "pessimistic" | "realistic" | "optimistic";

/** Multipliers/deltas applied to the base case to derive a scenario. */
export interface ScenarioAdjustment {
  label: string;
  /** Scales month-1 volume. */
  volumeMultiplier: number;
  /** Added to the growth rate per month (e.g. −0.02 = 2pp slower). */
  growthDelta: number;
  /** Scales per-unit COGS + variable costs (cost pressure). */
  variableCostMultiplier: number;
  /** Scales monthly fixed costs. */
  fixedCostMultiplier: number;
  /** Scales selling price. */
  priceMultiplier: number;
}

/**
 * Defaults: pessimistic = lower demand + cost pressure; optimistic = stronger demand + mild efficiency.
 * Price held constant (changing price AND costs at once double-counts and muddies the comparison).
 */
export const DEFAULT_SCENARIO_ADJUSTMENTS: Record<ScenarioKey, ScenarioAdjustment> = {
  pessimistic: { label: "Pesimistis", volumeMultiplier: 0.75, growthDelta: -0.02, variableCostMultiplier: 1.1, fixedCostMultiplier: 1.1, priceMultiplier: 1 },
  realistic: { label: "Realistis", volumeMultiplier: 1, growthDelta: 0, variableCostMultiplier: 1, fixedCostMultiplier: 1, priceMultiplier: 1 },
  optimistic: { label: "Optimistis", volumeMultiplier: 1.25, growthDelta: 0.02, variableCostMultiplier: 0.95, fixedCostMultiplier: 1, priceMultiplier: 1 },
};

function scaleItems(items: CostItem[], m: number): CostItem[] {
  if (m === 1) return items.map((i) => ({ label: i.label, amount: i.amount }));
  return items.map((i) => ({ label: i.label, amount: roundIDR(i.amount * m) }));
}

function adjustGrowth(growth: GrowthModel, delta: number): GrowthModel {
  const rate = growth.ratePerMonth + delta;
  if (growth.type === "seasonal") return { type: "seasonal", ratePerMonth: rate, seasonalIndices: growth.seasonalIndices };
  return { type: growth.type, ratePerMonth: rate };
}

/** Produce the adjusted inputs for one scenario (pure). */
export function applyScenarioAdjustment(inputs: FinancialInputs, adj: ScenarioAdjustment): FinancialInputs {
  return {
    ...inputs,
    price: roundIDR(inputs.price * adj.priceMultiplier),
    cogsItems: scaleItems(inputs.cogsItems, adj.variableCostMultiplier),
    variableCostsPerUnit: scaleItems(inputs.variableCostsPerUnit, adj.variableCostMultiplier),
    fixedCostsMonthly: scaleItems(inputs.fixedCostsMonthly, adj.fixedCostMultiplier),
    volumeInitial: Math.max(0, Math.round(inputs.volumeInitial * adj.volumeMultiplier)),
    growth: adjustGrowth(inputs.growth, adj.growthDelta),
  };
}

export interface ScenarioSet {
  pessimistic: FinancialsResult;
  realistic: FinancialsResult;
  optimistic: FinancialsResult;
}

/** Full three-scenario computation (each a complete FinancialsResult). */
export function computeScenarios(
  inputs: FinancialInputs,
  overrides?: Partial<Record<ScenarioKey, ScenarioAdjustment>>,
): ScenarioSet {
  const adj = { ...DEFAULT_SCENARIO_ADJUSTMENTS, ...overrides };
  return {
    pessimistic: computeFinancials(applyScenarioAdjustment(inputs, adj.pessimistic)),
    realistic: computeFinancials(applyScenarioAdjustment(inputs, adj.realistic)),
    optimistic: computeFinancials(applyScenarioAdjustment(inputs, adj.optimistic)),
  };
}

/** Compact KPI summary per scenario — what gets persisted with a BusinessPlan + shown for comparison. */
export interface ScenarioKpis {
  label: string;
  contributionMarginPerUnit: number;
  bepUnitsPerMonthRounded: number | null;
  paybackPeriodMonths: number | null;
  roiPct: number;
  totalNetProfitHorizon: number;
  finalCumulativeCash: number;
}

export function summarizeScenario(label: string, r: FinancialsResult): ScenarioKpis {
  const last = r.projections[r.projections.length - 1];
  return {
    label,
    contributionMarginPerUnit: r.unitEconomics.contributionMarginPerUnit,
    bepUnitsPerMonthRounded: r.breakEven.bepUnitsPerMonthRounded,
    paybackPeriodMonths: r.returns.paybackPeriodMonths,
    roiPct: r.returns.roiPct,
    totalNetProfitHorizon: r.returns.totalNetProfitHorizon,
    finalCumulativeCash: last?.cumulativeCash ?? 0,
  };
}

export type ScenarioSummarySet = Record<ScenarioKey, ScenarioKpis>;

export function computeScenarioSummaries(
  inputs: FinancialInputs,
  overrides?: Partial<Record<ScenarioKey, ScenarioAdjustment>>,
): ScenarioSummarySet {
  const adj = { ...DEFAULT_SCENARIO_ADJUSTMENTS, ...overrides };
  const set = computeScenarios(inputs, overrides);
  return {
    pessimistic: summarizeScenario(adj.pessimistic.label, set.pessimistic),
    realistic: summarizeScenario(adj.realistic.label, set.realistic),
    optimistic: summarizeScenario(adj.optimistic.label, set.optimistic),
  };
}
