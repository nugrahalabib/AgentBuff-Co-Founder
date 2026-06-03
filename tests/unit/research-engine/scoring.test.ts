import { describe, expect, it } from "vitest";
import {
  clamp01,
  computeValidationScore,
  deriveMarginHeadroom,
  recommend,
} from "../../../src/server/engine/research/index";

describe("clamp01", () => {
  it("clamps into [0,1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("deriveMarginHeadroom", () => {
  it("computes (price − cost)/price clamped to 0..1", () => {
    expect(deriveMarginHeadroom(20_000, 8_000)).toBeCloseTo(0.6, 9);
    expect(deriveMarginHeadroom(20_000, 25_000)).toBe(0); // cost > price → clamped
    expect(deriveMarginHeadroom(0, 5_000)).toBe(0); // non-positive price guarded
  });
});

describe("recommend", () => {
  it("bands the score (>=70 go, 45..69 refine, <45 reconsider)", () => {
    expect(recommend(100)).toBe("go");
    expect(recommend(70)).toBe("go");
    expect(recommend(69)).toBe("refine");
    expect(recommend(45)).toBe("refine");
    expect(recommend(44)).toBe("reconsider");
    expect(recommend(0)).toBe("reconsider");
  });
});

describe("computeValidationScore", () => {
  it("scores 100 / go when every signal is maxed", () => {
    const r = computeValidationScore({
      demandStrength: 1,
      marginHeadroom: 1,
      competitionGap: 1,
      differentiation: 1,
    });
    expect(r.score).toBe(100);
    expect(r.recommendation).toBe("go");
    expect(r.breakdown).toEqual({
      demand: 35,
      margin: 30,
      competition: 20,
      differentiation: 15,
      regulatoryPenalty: 0,
    });
  });

  it("produces a refine-band mid score", () => {
    const r = computeValidationScore({
      demandStrength: 0.6,
      marginHeadroom: 0.5,
      competitionGap: 0.5,
      differentiation: 0.4,
    });
    expect(r.score).toBe(52); // 21 + 15 + 10 + 6
    expect(r.recommendation).toBe("refine");
  });

  it("produces a reconsider-band low score", () => {
    const r = computeValidationScore({
      demandStrength: 0.2,
      marginHeadroom: 0.2,
      competitionGap: 0.2,
      differentiation: 0.2,
    });
    expect(r.score).toBe(20); // 7 + 6 + 4 + 3
    expect(r.recommendation).toBe("reconsider");
  });

  it("subtracts the regulatory penalty and floors the score at 0", () => {
    const r = computeValidationScore({
      demandStrength: 0.2,
      marginHeadroom: 0.2,
      competitionGap: 0.2,
      differentiation: 0.2,
      regulatoryPenalty: 0.5,
    });
    expect(r.score).toBe(0); // 0.20 − 0.50 = −0.30 → clamped to 0
    expect(r.breakdown.regulatoryPenalty).toBe(50);
  });

  it("clamps out-of-range signals", () => {
    const r = computeValidationScore({
      demandStrength: -1, // → 0
      marginHeadroom: 2, // → 1
      competitionGap: 0,
      differentiation: 0,
    });
    expect(r.breakdown.demand).toBe(0);
    expect(r.breakdown.margin).toBe(30);
    expect(r.score).toBe(30);
  });

  it("honors custom weights", () => {
    const r = computeValidationScore(
      { demandStrength: 1, marginHeadroom: 1, competitionGap: 1, differentiation: 1 },
      { demand: 0.5, margin: 0.5, competition: 0, differentiation: 0 },
    );
    expect(r.score).toBe(100); // 50 + 50
  });
});
