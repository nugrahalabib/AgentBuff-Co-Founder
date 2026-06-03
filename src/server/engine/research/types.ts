// src/server/engine/research/types.ts
// Deterministic validation scoring. PRD §9.2.4. The LLM supplies grounded, structured signals;
// the SCORE itself is computed here in code (never asked from the LLM). Like the Financial Engine,
// this is pure and deterministic.

export type Recommendation = "go" | "refine" | "reconsider";

/** Normalized 0..1 signals distilled from the grounded research stages (§9.2.3). */
export interface ValidationSignals {
  /** Strength & breadth of demand signals + trend direction. */
  demandStrength: number;
  /** (price_median − cost_estimate) / price_median, clamped 0..1. See `deriveMarginHeadroom`. */
  marginHeadroom: number;
  /** 1 − saturation_index (more competitors / stronger incumbents → lower). */
  competitionGap: number;
  /** Fit of the value prop against competitor weaknesses (LLM-scored, small weight). */
  differentiation: number;
  /** Penalty (0..1) for heavy unmet regulatory requirements. Default 0. */
  regulatoryPenalty?: number;
}

export interface ScoreWeights {
  demand: number;
  margin: number;
  competition: number;
  differentiation: number;
}

/** PRD §9.2.4 default weights (Σ = 1). */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  demand: 0.35,
  margin: 0.3,
  competition: 0.2,
  differentiation: 0.15,
};

export interface ScoreBreakdown {
  /** Each component's contribution to the 0..100 score (already weighted). */
  demand: number;
  margin: number;
  competition: number;
  differentiation: number;
  regulatoryPenalty: number;
}

export interface ValidationScore {
  /** 0..100, integer. */
  score: number;
  recommendation: Recommendation;
  breakdown: ScoreBreakdown;
}
