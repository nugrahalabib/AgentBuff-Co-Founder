import { describe, expect, it } from "vitest";
import { projectUnits } from "../../../src/server/engine/financial/index";

describe("projectUnits", () => {
  it("linear growth is additive on the initial volume", () => {
    expect(projectUnits(600, { type: "linear", ratePerMonth: 0.1 }, 1)).toBe(600);
    expect(projectUnits(600, { type: "linear", ratePerMonth: 0.1 }, 3)).toBeCloseTo(720, 9); // 600*(1+0.1*2)
  });

  it("compound growth is geometric", () => {
    expect(projectUnits(600, { type: "compound", ratePerMonth: 0.1 }, 1)).toBe(600);
    expect(projectUnits(600, { type: "compound", ratePerMonth: 0.1 }, 3)).toBeCloseTo(726, 9); // 600*1.1^2
  });

  it("seasonal growth multiplies the compound baseline by a cyclic index", () => {
    const g = { type: "seasonal" as const, ratePerMonth: 0, seasonalIndices: [1, 0.5] };
    expect(projectUnits(100, g, 1)).toBe(100);
    expect(projectUnits(100, g, 2)).toBe(50);
    expect(projectUnits(100, g, 3)).toBe(100); // index cycles
  });

  it("can return a raw negative value under steep decline (engine clamps it)", () => {
    expect(projectUnits(100, { type: "linear", ratePerMonth: -0.5 }, 4)).toBe(-50);
  });
});
