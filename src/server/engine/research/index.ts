// src/server/engine/research/index.ts — deterministic validation scoring. PRD §9.2.4.
export { computeValidationScore, recommend, deriveMarginHeadroom, clamp01 } from "./scoring";
export {
  deriveDemandStrength,
  deriveCompetitionGap,
  deriveRegulatoryPenalty,
  assembleSignals,
  type TrendDirection,
  type RiskSignal,
  type SignalInputs,
} from "./signals";
export * from "./types";
