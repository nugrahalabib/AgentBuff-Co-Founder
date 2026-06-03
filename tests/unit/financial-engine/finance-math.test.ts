import { describe, expect, it } from "vitest";
import {
  annualToMonthlyRate,
  irrPerPeriod,
  monthlyToAnnualRate,
  npv,
} from "../../../src/server/engine/financial/index";

describe("npv", () => {
  it("at 0% discount is the plain sum", () => {
    expect(npv(0, [-1000, 600, 600])).toBe(200);
  });

  it("discounts future flows", () => {
    expect(npv(0.1, [-1000, 600, 600])).toBeCloseTo(41.3223, 3);
  });
});

describe("rate conversions", () => {
  it("round-trips annual <-> monthly", () => {
    expect(annualToMonthlyRate(0)).toBe(0);
    expect(monthlyToAnnualRate(0)).toBe(0);
    expect(monthlyToAnnualRate(annualToMonthlyRate(0.12))).toBeCloseTo(0.12, 9);
  });
});

describe("irrPerPeriod", () => {
  it("finds the rate that zeroes NPV", () => {
    expect(irrPerPeriod([-100, 110])!).toBeCloseTo(0.1, 9);
    expect(irrPerPeriod([-1000, 600, 600])!).toBeCloseTo(0.13066, 4);
  });

  it("accepts explicit solver options", () => {
    expect(irrPerPeriod([-100, 110], { lo: -0.9999, hi: 10, tol: 1e-9, maxIter: 200 })!).toBeCloseTo(0.1, 9);
  });

  it("returns null when there is no sign change", () => {
    expect(irrPerPeriod([100, 200])).toBeNull(); // all positive
    expect(irrPerPeriod([-100, -200])).toBeNull(); // all negative
  });

  it("finds a very high IRR by expanding the bracket (regression: was wrongly null)", () => {
    expect(irrPerPeriod([-1_000_000, 15_000_000])!).toBeCloseTo(14, 6); // 1 period, IRR 1400%/period
    expect(irrPerPeriod([-1_000_000, 12_000_000, 12_000_000, 12_000_000])!).toBeGreaterThan(10);
  });

  it("returns null for a sign change with no real root, and for a leading zero", () => {
    expect(irrPerPeriod([100, -300, 250])).toBeNull(); // discriminant < 0 → complex roots only
    expect(irrPerPeriod([0, 500])).toBeNull(); // leading zero then all positive → no sign change
  });
});
