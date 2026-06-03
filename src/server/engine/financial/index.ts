// src/server/engine/financial/index.ts
// Public surface of the Deterministic Financial Engine (PRD §9.3).
// Consumers (PlannerService, MCP `agentbuff.calculate_financials`, document Skills)
// import from here only.

export { computeFinancials, validateInputs } from "./engine";
export { roundIDR, roundTo, ratio, sumAmounts } from "./money";
export { projectUnits } from "./growth";
export { amortize, type LoanScheduleEntry } from "./loan";
export { npv, irrPerPeriod, annualToMonthlyRate, monthlyToAnnualRate } from "./finance-math";
export * from "./types";
