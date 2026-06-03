import { describe, expect, it } from "vitest";
import { ratio, roundIDR, roundTo, sumAmounts } from "../../../src/server/engine/financial/index";

describe("roundIDR", () => {
  it("rounds half away from zero", () => {
    expect(roundIDR(1234.5)).toBe(1235);
    expect(roundIDR(-1234.5)).toBe(-1235);
    expect(roundIDR(1234.4)).toBe(1234);
    expect(roundIDR(1234.6)).toBe(1235);
    expect(roundIDR(0.5)).toBe(1);
    expect(roundIDR(-0.5)).toBe(-1);
  });

  it("normalizes zero and tiny magnitudes to positive zero", () => {
    expect(roundIDR(0)).toBe(0);
    expect(Object.is(roundIDR(-0.4), 0)).toBe(true); // not -0
  });
});

describe("roundTo", () => {
  it("rounds to N decimal places, half away from zero", () => {
    expect(roundTo(0.123456, 4)).toBe(0.1235);
    expect(roundTo(-0.123456, 4)).toBe(-0.1235);
    expect(roundTo(2.5, 0)).toBe(3);
  });

  it("normalizes to positive zero", () => {
    expect(roundTo(0, 2)).toBe(0);
    expect(Object.is(roundTo(-0.001, 2), 0)).toBe(true);
  });
});

describe("ratio", () => {
  it("divides, guarding against a zero denominator", () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(5, 0)).toBe(0);
  });
});

describe("sumAmounts", () => {
  it("sums the amount field, defaulting to 0 for an empty list", () => {
    expect(sumAmounts([{ amount: 1 }, { amount: 2.5 }])).toBe(3.5);
    expect(sumAmounts([])).toBe(0);
  });
});
