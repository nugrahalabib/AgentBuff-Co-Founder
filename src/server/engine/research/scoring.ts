// src/server/engine/research/scoring.ts
// Deterministic ValidationScore. PRD §9.2.4:
//   ValidationScore = 100 * ( w1*demand + w2*margin + w3*competition + w4*differentiation − penalty )
//   bands: >=70 "go", 45..69 "refine", <45 "reconsider".

import {
  DEFAULT_WEIGHTS,
  type Recommendation,
  type ScoreWeights,
  type ValidationScore,
  type ValidationSignals,
} from "./types";

/** Clamp a value into [0, 1]. */
export function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** margin_headroom = (price_median − cost_estimate) / price_median, clamped 0..1. */
export function deriveMarginHeadroom(priceMedian: number, costEstimate: number): number {
  if (priceMedian <= 0) return 0;
  return clamp01((priceMedian - costEstimate) / priceMedian);
}

/** Map a 0..100 score to a Go/Refine/Reconsider recommendation. PRD §9.2.4. */
export function recommend(score: number): Recommendation {
  if (score >= 70) return "go";
  if (score >= 45) return "refine";
  return "reconsider";
}

/**
 * Compute the deterministic validation score and its transparent per-component breakdown.
 * Signals are clamped to 0..1; the final score is clamped to 0..100 and rounded.
 */
export function computeValidationScore(
  signals: ValidationSignals,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ValidationScore {
  const demand = weights.demand * clamp01(signals.demandStrength);
  const margin = weights.margin * clamp01(signals.marginHeadroom);
  const competition = weights.competition * clamp01(signals.competitionGap);
  const differentiation = weights.differentiation * clamp01(signals.differentiation);
  const penalty = clamp01(signals.regulatoryPenalty ?? 0);

  const raw = clamp01(demand + margin + competition + differentiation - penalty);
  const score = Math.round(raw * 100);

  return {
    score,
    recommendation: recommend(score),
    breakdown: {
      demand: Math.round(demand * 100),
      margin: Math.round(margin * 100),
      competition: Math.round(competition * 100),
      differentiation: Math.round(differentiation * 100),
      regulatoryPenalty: Math.round(penalty * 100),
    },
  };
}
