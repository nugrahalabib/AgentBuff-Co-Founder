// src/server/engine/financial/loan.ts
// Loan amortization (equal-installment / annuity). Monthly rate = annualRate / 12
// (nominal, compounded monthly — the common consumer-loan convention). PRD §9.3.5.

import type { Loan } from "./types";

export interface LoanScheduleEntry {
  month: number;
  interest: number;
  principal: number;
  payment: number;
  /** Outstanding balance after this month's payment. */
  balance: number;
}

/**
 * Build the full amortization schedule. Full precision (caller rounds for display).
 * The final installment clears any residual balance exactly, so Σ principal = principal.
 */
export function amortize(loan: Loan): LoanScheduleEntry[] {
  const { principal, annualInterestRate, tenorMonths } = loan;
  const r = annualInterestRate / 12;
  const n = tenorMonths;

  const installment =
    r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));

  const entries: LoanScheduleEntry[] = [];
  let balance = principal;

  for (let month = 1; month <= n; month++) {
    const interest = balance * r;
    // Last installment absorbs any floating residual so the loan closes at exactly 0.
    const principalPaid = month === n ? balance : installment - interest;
    balance = balance - principalPaid;
    entries.push({
      month,
      interest,
      principal: principalPaid,
      payment: interest + principalPaid,
      balance,
    });
  }

  return entries;
}
