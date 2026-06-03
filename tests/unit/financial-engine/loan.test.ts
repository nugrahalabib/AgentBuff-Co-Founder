import { describe, expect, it } from "vitest";
import { amortize } from "../../../src/server/engine/financial/index";

describe("amortize", () => {
  it("handles a zero-interest loan as equal principal slices", () => {
    const schedule = amortize({ principal: 1_200, annualInterestRate: 0, tenorMonths: 12 });
    expect(schedule).toHaveLength(12);
    expect(schedule.every((e) => e.interest === 0)).toBe(true);
    expect(schedule[0]!.principal).toBe(100);
    expect(schedule[11]!.balance).toBeCloseTo(0, 9);
    expect(schedule.reduce((a, e) => a + e.principal, 0)).toBeCloseTo(1_200, 9);
  });

  it("amortizes an interest-bearing loan to a zero balance", () => {
    const schedule = amortize({ principal: 12_000_000, annualInterestRate: 0.12, tenorMonths: 12 });
    expect(schedule).toHaveLength(12);
    expect(schedule[0]!.interest).toBeCloseTo(120_000, 6); // 12.000.000 * 0.01

    // interest each month is the previous balance * monthly rate
    let balance = 12_000_000;
    for (const entry of schedule) {
      expect(entry.interest).toBeCloseTo(balance * 0.01, 4);
      expect(entry.payment).toBeCloseTo(entry.interest + entry.principal, 9);
      balance = entry.balance;
    }

    expect(schedule.reduce((a, e) => a + e.principal, 0)).toBeCloseTo(12_000_000, 4);
    expect(schedule[11]!.balance).toBeCloseTo(0, 4);
  });
});
