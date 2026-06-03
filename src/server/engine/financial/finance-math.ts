// src/server/engine/financial/finance-math.ts
// NPV and IRR for a periodic cash-flow series. PRD §9.3.5 (optional advanced KPIs).
// cashflows[0] is the t=0 flow (typically the investment outflow, negative).

/** Net present value at a per-period rate. */
export function npv(ratePerPeriod: number, cashflows: number[]): number {
  let acc = 0;
  for (let t = 0; t < cashflows.length; t++) {
    acc += (cashflows[t] as number) / Math.pow(1 + ratePerPeriod, t);
  }
  return acc;
}

/** Convert an annual rate to its effective per-month equivalent. */
export function annualToMonthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** Convert an effective per-month rate to its annual equivalent. */
export function monthlyToAnnualRate(monthly: number): number {
  return Math.pow(1 + monthly, 12) - 1;
}

/** Upper bound for geometric bracket expansion when searching for a very high IRR. */
const IRR_HI_CAP = 1e9;

/**
 * Internal rate of return per period, via bracketed bisection. Returns null ONLY when the
 * series has no sign change (no IRR can exist, e.g. all-positive or all-negative), or when a
 * sign change exists but no real positive-NPV root can be bracketed (e.g. complex roots only).
 *
 * The initial bracket [lo, hi] is expanded geometrically so that a high per-period IRR (one that
 * exceeds the default start bracket of 1000%/period) is still found instead of being mis-reported
 * as "no IRR" — important for short horizons where monthly net profit greatly exceeds the outlay.
 */
export function irrPerPeriod(
  cashflows: number[],
  opts?: { lo?: number; hi?: number; tol?: number; maxIter?: number },
): number | null {
  const lo = opts?.lo ?? -0.9999;
  const hiStart = opts?.hi ?? 10;
  const tol = opts?.tol ?? 1e-9;
  const maxIter = opts?.maxIter ?? 200;

  // An IRR requires at least one sign change in the cash-flow series.
  let signChanges = 0;
  let prevSign = 0;
  for (const cf of cashflows) {
    const sign = Math.sign(cf);
    if (sign !== 0) {
      if (prevSign !== 0 && sign !== prevSign) signChanges++;
      prevSign = sign;
    }
  }
  if (signChanges === 0) return null;

  const f = (rate: number): number => npv(rate, cashflows);
  const flo = f(lo);

  // Grow `hi` until f(lo) and f(hi) straddle zero (NPV is monotonic in rate for a conventional
  // outflow-then-inflows series), so high IRRs are bracketed rather than dropped.
  let hi = hiStart;
  let fhi = f(hi);
  while (Math.sign(flo) === Math.sign(fhi) && hi < IRR_HI_CAP) {
    hi *= 10;
    fhi = f(hi);
  }
  if (Math.sign(flo) === Math.sign(fhi)) return null; // no bracketable real root

  let bisectLo = lo;
  let bisectFlo = flo;
  let bisectHi = hi;
  for (let i = 0; i < maxIter; i++) {
    const mid = (bisectLo + bisectHi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < tol) return mid;
    if (Math.sign(fmid) === Math.sign(bisectFlo)) {
      bisectLo = mid;
      bisectFlo = fmid;
    } else {
      bisectHi = mid;
    }
  }
  /* v8 ignore next 2 */ // bisection converges well within maxIter for finite inputs
  return (bisectLo + bisectHi) / 2;
}
