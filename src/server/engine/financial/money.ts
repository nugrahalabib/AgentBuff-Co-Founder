// src/server/engine/financial/money.ts
// Pure rounding helpers. Money is whole rupiah; "round half away from zero" so that
// rounding is symmetric and auditable (PRD §9.3.5 "pembulatan konsisten").

/** Round to whole IDR, half away from zero. Normalizes -0 to 0. */
export function roundIDR(n: number): number {
  const r = Math.sign(n) * Math.round(Math.abs(n));
  return r === 0 ? 0 : r;
}

/** Round to `dp` decimal places, half away from zero. */
export function roundTo(n: number, dp: number): number {
  const f = 10 ** dp;
  const r = (Math.sign(n) * Math.round(Math.abs(n) * f)) / f;
  return r === 0 ? 0 : r;
}

/** Safe ratio: returns 0 when the denominator is 0 (avoids NaN/Infinity). */
export function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

/** Sum the `amount` field of cost items without indexed access (strict-safe). */
export function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((acc, item) => acc + item.amount, 0);
}
