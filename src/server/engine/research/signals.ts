// src/server/engine/research/signals.ts
// Deterministic derivation of ValidationSignals from the structured outputs of the grounded research
// stages (§9.2.3 stages 1–4). "LLM Proposes, Code Disposes": the LLM returns grounded structured facts
// (competitor list, price band, demand signals, risks); these functions turn those facts into the 0..1
// signals that feed the deterministic ValidationScore. Pure + side-effect-free → unit-tested to 100%.

import { clamp01, deriveMarginHeadroom } from "./scoring";
import type { ValidationSignals } from "./types";

export type TrendDirection = "rising" | "stable" | "declining" | "unknown";

/** A risk with a category and 1–5 severity (from stage 4). */
export interface RiskSignal {
  category: "regulatory" | "market" | "operational" | "financial" | "other";
  severity: number;
}

/**
 * demand_strength from the breadth of distinct demand signals + trend direction.
 * 0 signals → 0. Breadth saturates at `saturateAt` distinct signals; a rising trend lifts the score,
 * a declining one lowers it.
 */
export function deriveDemandStrength(signalCount: number, trend: TrendDirection, saturateAt = 5): number {
  const breadth = clamp01(Math.max(0, signalCount) / saturateAt);
  if (breadth === 0) return 0;
  const trendAdj = trend === "rising" ? 0.15 : trend === "declining" ? -0.2 : 0;
  return clamp01(breadth + trendAdj);
}

/**
 * competition_gap = 1 − saturation_index. Saturation rises with the number of credible competitors,
 * saturating at `saturateAt`. 0 competitors → wide-open gap (1.0); many → crowded (→ 0).
 */
export function deriveCompetitionGap(competitorCount: number, saturateAt = 8): number {
  const saturation = clamp01(Math.max(0, competitorCount) / saturateAt);
  return clamp01(1 - saturation);
}

/**
 * regulatory penalty (0..1) from the cumulative severity of regulatory-category risks.
 * Each severity point counts; `fullPenaltyAt` total severity → full penalty.
 */
export function deriveRegulatoryPenalty(risks: RiskSignal[], fullPenaltyAt = 10): number {
  const total = risks
    .filter((r) => r.category === "regulatory")
    .reduce((sum, r) => sum + clamp01(Math.max(0, r.severity) / 5) * 5, 0);
  return clamp01(total / fullPenaltyAt);
}

export interface SignalInputs {
  demandSignalCount: number;
  trend: TrendDirection;
  priceMedian: number;
  costEstimate: number;
  competitorCount: number;
  /** LLM-proposed 0..1 fit of the value prop vs competitor weaknesses (small weight). */
  differentiation: number;
  risks: RiskSignal[];
}

/** Assemble the full ValidationSignals from the grounded structured facts. Margin & competition & demand & penalty are derived in code; differentiation is the only LLM-scored input. */
export function assembleSignals(input: SignalInputs): ValidationSignals {
  return {
    demandStrength: deriveDemandStrength(input.demandSignalCount, input.trend),
    marginHeadroom: deriveMarginHeadroom(input.priceMedian, input.costEstimate),
    competitionGap: deriveCompetitionGap(input.competitorCount),
    differentiation: clamp01(input.differentiation),
    regulatoryPenalty: deriveRegulatoryPenalty(input.risks),
  };
}
