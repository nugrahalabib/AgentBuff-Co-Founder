import { describe, expect, it } from "vitest";
import {
  assembleSignals,
  deriveCompetitionGap,
  deriveDemandStrength,
  deriveRegulatoryPenalty,
  type RiskSignal,
} from "../../../src/server/engine/research/index";

describe("deriveDemandStrength", () => {
  it("is 0 when there are no demand signals (regardless of trend)", () => {
    expect(deriveDemandStrength(0, "rising")).toBe(0);
    expect(deriveDemandStrength(0, "unknown")).toBe(0);
  });

  it("saturates breadth at the configured count", () => {
    expect(deriveDemandStrength(5, "stable")).toBe(1);
    expect(deriveDemandStrength(10, "stable")).toBe(1); // clamped
    expect(deriveDemandStrength(2, "stable")).toBeCloseTo(0.4, 10);
  });

  it("lifts on a rising trend and drops on a declining one", () => {
    expect(deriveDemandStrength(2, "rising")).toBeCloseTo(0.55, 10); // 0.4 + 0.15
    expect(deriveDemandStrength(2, "declining")).toBeCloseTo(0.2, 10); // 0.4 − 0.2
    expect(deriveDemandStrength(2, "unknown")).toBeCloseTo(0.4, 10); // no adj
  });

  it("clamps the trend-adjusted result into 0..1", () => {
    expect(deriveDemandStrength(1, "declining")).toBe(0); // 0.2 − 0.2 = 0
    expect(deriveDemandStrength(5, "rising")).toBe(1); // 1 + 0.15 clamped
  });
});

describe("deriveCompetitionGap", () => {
  it("is wide-open (1) with no competitors and crowded (0) at/above saturation", () => {
    expect(deriveCompetitionGap(0)).toBe(1);
    expect(deriveCompetitionGap(8)).toBe(0);
    expect(deriveCompetitionGap(20)).toBe(0); // clamped
  });

  it("decreases linearly toward saturation", () => {
    expect(deriveCompetitionGap(4)).toBeCloseTo(0.5, 10);
    expect(deriveCompetitionGap(2)).toBeCloseTo(0.75, 10);
  });

  it("treats negative counts as zero", () => {
    expect(deriveCompetitionGap(-3)).toBe(1);
  });
});

describe("deriveRegulatoryPenalty", () => {
  const reg = (severity: number): RiskSignal => ({ category: "regulatory", severity });

  it("is 0 with no regulatory risks", () => {
    expect(deriveRegulatoryPenalty([])).toBe(0);
    expect(deriveRegulatoryPenalty([{ category: "market", severity: 5 }])).toBe(0); // non-regulatory ignored
  });

  it("accumulates regulatory severity and saturates at full penalty", () => {
    expect(deriveRegulatoryPenalty([reg(5), reg(5)])).toBe(1); // 10/10
    expect(deriveRegulatoryPenalty([reg(5)])).toBeCloseTo(0.5, 10);
    expect(deriveRegulatoryPenalty([reg(2)])).toBeCloseTo(0.2, 10);
  });

  it("clamps per-risk severity to 5 and overall to 1", () => {
    expect(deriveRegulatoryPenalty([reg(99)])).toBeCloseTo(0.5, 10); // capped at sev 5 → 5/10
    expect(deriveRegulatoryPenalty([reg(5), reg(5), reg(5)])).toBe(1); // 15 → clamp 1
    expect(deriveRegulatoryPenalty([reg(-3)])).toBe(0); // negative → 0
  });
});

describe("assembleSignals", () => {
  it("derives margin/competition/demand/penalty in code and passes differentiation through", () => {
    const s = assembleSignals({
      demandSignalCount: 5,
      trend: "stable",
      priceMedian: 20000,
      costEstimate: 8000,
      competitorCount: 4,
      differentiation: 0.6,
      risks: [{ category: "regulatory", severity: 5 }],
    });
    expect(s.demandStrength).toBe(1);
    expect(s.marginHeadroom).toBeCloseTo(0.6, 10); // (20000−8000)/20000
    expect(s.competitionGap).toBeCloseTo(0.5, 10);
    expect(s.differentiation).toBe(0.6);
    expect(s.regulatoryPenalty).toBeCloseTo(0.5, 10);
  });

  it("clamps an out-of-range differentiation", () => {
    const s = assembleSignals({
      demandSignalCount: 1,
      trend: "unknown",
      priceMedian: 0, // → margin 0 path
      costEstimate: 100,
      competitorCount: 0,
      differentiation: 2,
      risks: [],
    });
    expect(s.marginHeadroom).toBe(0);
    expect(s.differentiation).toBe(1);
  });
});
