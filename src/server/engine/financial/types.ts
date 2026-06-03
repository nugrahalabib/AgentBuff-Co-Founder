// src/server/engine/financial/types.ts
// Deterministic Financial Engine — types. PRD §9.3, §9.3.10, §20.4 (financials_result).
//
// CONTRACT: this engine NEVER calls an LLM and produces NO side effects (no I/O,
// no Date.now, no Math.random). Same inputs → same outputs, always. (PRD §3.3, §9.3.2)
// Currency is IDR throughout; money is whole rupiah, ratios are unrounded fractions.

export type Currency = "IDR";

/** Determines which cost structure applies. `service`/`digital` may have empty COGS. */
export type BusinessModelType = "physical" | "service" | "digital" | "hybrid";

/** A named money amount. For COGS/variable it is per-unit; for fixed it is per-month; for capex it is one-off. */
export interface CostItem {
  label: string;
  amount: number;
}

/**
 * Monthly sales-volume projection model.
 * - linear:   units_t = initial * (1 + rate*(t-1))           (additive growth)
 * - compound: units_t = initial * (1 + rate)^(t-1)           (geometric growth)
 * - seasonal: compound baseline * seasonalIndices[(t-1) mod n]
 * `ratePerMonth` may be negative (decline). t is 1-based.
 */
export type GrowthModel =
  | { type: "linear"; ratePerMonth: number }
  | { type: "compound"; ratePerMonth: number }
  | { type: "seasonal"; ratePerMonth: number; seasonalIndices: number[] };

export interface Loan {
  principal: number;
  /** Nominal annual interest rate, e.g. 0.12 = 12%/yr. Amortized monthly (annuity). */
  annualInterestRate: number;
  tenorMonths: number;
}

export interface Funding {
  equity: number;
  loan?: Loan;
}

/**
 * Tax handling (PRD §9.3.5 tax_estimate_t; Open Question Q7).
 * - none:          no tax modeled (default).
 * - final_revenue: UMKM final income tax on gross revenue (e.g. PP 55/2022 → rate 0.005).
 * - income:        income tax on positive pre-tax profit (revenue − all costs − interest).
 */
export type TaxMode = "none" | "final_revenue" | "income";
export interface TaxConfig {
  mode: TaxMode;
  rate: number;
}

export interface FinancialInputs {
  modelType: BusinessModelType;
  currency?: Currency;
  /** Selling price per unit (IDR). Must be > 0. */
  price: number;
  /** Per-unit COGS components (HPP). Empty allowed for pure service/digital. */
  cogsItems: CostItem[];
  /** Per-unit non-COGS variable costs (commission, shipping, …). */
  variableCostsPerUnit: CostItem[];
  /** Monthly fixed costs (rent, salary, subscriptions, …). */
  fixedCostsMonthly: CostItem[];
  /** One-off startup capital expenditures (equipment, renovation, initial stock, permits). */
  capexItems: CostItem[];
  /** Extra working-capital cushion added to startup capital. Default 0. */
  workingCapitalBuffer?: number;
  /** Month-1 sales volume (units). Must be >= 0. */
  volumeInitial: number;
  growth: GrowthModel;
  funding: Funding;
  /** Projection horizon in months (12 / 24 / 36 typical). Integer >= 1. */
  horizonMonths: number;
  /** Default { mode: "none", rate: 0 }. */
  tax?: TaxConfig;
  /** Annual discount rate for NPV (e.g. 0.1 = 10%/yr). When omitted, NPV is not computed. */
  discountRateAnnual?: number;
}

export interface UnitEconomics {
  price: number;
  /** HPP per unit = Σ cogsItems. */
  hppPerUnit: number;
  variablePerUnit: number;
  /** price − hppPerUnit − variablePerUnit. */
  contributionMarginPerUnit: number;
  /** contributionMarginPerUnit / price (unrounded fraction). */
  contributionMarginPct: number;
  /** (price − hppPerUnit) / price (unrounded fraction). */
  grossMarginPct: number;
}

export interface BreakEven {
  /** True when contribution margin per unit > 0. */
  feasible: boolean;
  /** fixed / contribution (exact). null when not feasible. */
  bepUnitsPerMonth: number | null;
  /** ceil(bepUnitsPerMonth). null when not feasible. */
  bepUnitsPerMonthRounded: number | null;
  /** bepUnitsPerMonth * price, rounded to IDR. null when not feasible. */
  bepRevenuePerMonth: number | null;
  /** First projection month whose volume reaches BEP (null if never / not feasible). */
  bepReachedMonth: number | null;
}

export interface Capital {
  totalCapex: number;
  workingCapitalBuffer: number;
  /** totalCapex + workingCapitalBuffer. */
  startupCapital: number;
  equity: number;
  loanPrincipal: number;
  /** equity + loanPrincipal − startupCapital. Negative = underfunded (funding gap). */
  openingCash: number;
  /** Investment basis for ROI/NPV/IRR. Equals startupCapital. */
  totalInvestment: number;
}

export interface MonthlyProjection {
  month: number;
  units: number;
  revenue: number;
  cogs: number;
  variableCosts: number;
  /** revenue − cogs. */
  grossProfit: number;
  fixedCosts: number;
  loanInterest: number;
  loanPrincipalRepayment: number;
  tax: number;
  /** grossProfit − variableCosts − fixedCosts (operating profit, before interest & tax). */
  operatingProfit: number;
  /** operatingProfit − loanInterest − tax. */
  netProfit: number;
  /** netProfit − loanPrincipalRepayment. */
  cashFlow: number;
  cumulativeNetProfit: number;
  /** openingCash + Σ cashFlow up to this month. */
  cumulativeCash: number;
}

export interface Returns {
  totalNetProfitHorizon: number;
  /**
   * Cumulative return over the whole horizon = totalNetProfitHorizon / totalInvestment
   * (0 when no investment). This is the §9.3.5 "ROI (horizon)" / §9.3.10 `roi_pct` value — it is
   * NOT annualized. Use `irrAnnualPct` for an annualized rate; when mapping to the §20.4 wire
   * contract, do NOT serialize this field as `roi_annualized`.
   */
  roiPct: number;
  /** First month cumulativeNetProfit >= startupCapital. null if not reached within horizon. */
  paybackPeriodMonths: number | null;
  /** Net present value of [−startupCapital, netProfit_1..h] at the monthly discount rate. null when no discount rate given. */
  npv: number | null;
  /** Internal rate of return, annualized fraction. null when undefined (no sign change). */
  irrAnnualPct: number | null;
  /** First month cumulativeCash < 0 (cash runs out). null if it never does. */
  runwayMonths: number | null;
}

export type WarningCode =
  | "price_below_cost"
  | "very_high_margin"
  | "zero_volume"
  | "negative_growth"
  | "funding_gap"
  | "bep_not_reached"
  | "payback_exceeds_horizon"
  | "loss_making_horizon";

export interface FinancialWarning {
  code: WarningCode;
  severity: "error" | "warning" | "info";
  /** User-facing message in Bahasa Indonesia (PRD §14.8). */
  message: string;
}

export interface FinancialsResult {
  currency: Currency;
  unitEconomics: UnitEconomics;
  breakEven: BreakEven;
  capital: Capital;
  projections: MonthlyProjection[];
  returns: Returns;
  warnings: FinancialWarning[];
}

/** Thrown for structurally invalid inputs (precondition violations), not business-logic concerns. */
export class FinancialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialInputError";
  }
}
