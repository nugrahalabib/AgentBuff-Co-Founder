// src/server/engine/financial/engine.ts
// Deterministic Financial Engine orchestrator. PRD §9.3.5.
// "LLM Proposes, Code Disposes": every number below is computed here, never by an LLM.

import { annualToMonthlyRate, irrPerPeriod, monthlyToAnnualRate, npv } from "./finance-math";
import { projectUnits } from "./growth";
import { amortize, type LoanScheduleEntry } from "./loan";
import { ratio, roundIDR, roundTo, sumAmounts } from "./money";
import {
  FinancialInputError,
  type BreakEven,
  type Capital,
  type CostItem,
  type Currency,
  type FinancialInputs,
  type FinancialsResult,
  type FinancialWarning,
  type MonthlyProjection,
  type Returns,
  type UnitEconomics,
} from "./types";

const MAX_HORIZON_MONTHS = 600;

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new FinancialInputError(message);
}

function ensureFinite(value: number, label: string): void {
  ensure(Number.isFinite(value), `${label} harus berupa angka.`);
}

function ensureNonNegativeFinite(value: number, label: string): void {
  ensureFinite(value, label);
  ensure(value >= 0, `${label} tidak boleh negatif.`);
}

function ensureItems(items: CostItem[], label: string): void {
  for (const item of items) ensureNonNegativeFinite(item.amount, `${label} "${item.label}"`);
}

/** Validate structural preconditions. Throws FinancialInputError; never mutates. */
export function validateInputs(i: FinancialInputs): void {
  ensureFinite(i.price, "Harga jual (price)");
  ensure(i.price > 0, "Harga jual (price) harus lebih dari 0.");

  ensureItems(i.cogsItems, "Biaya bahan (COGS)");
  ensureItems(i.variableCostsPerUnit, "Biaya variabel");
  ensureItems(i.fixedCostsMonthly, "Biaya tetap bulanan");
  ensureItems(i.capexItems, "Modal awal (capex)");

  ensureNonNegativeFinite(i.volumeInitial, "Volume penjualan awal");

  ensure(Number.isInteger(i.horizonMonths), "Horizon (bulan) harus bilangan bulat.");
  ensure(i.horizonMonths >= 1, "Horizon (bulan) minimal 1.");
  ensure(i.horizonMonths <= MAX_HORIZON_MONTHS, `Horizon (bulan) maksimal ${MAX_HORIZON_MONTHS}.`);

  if (i.workingCapitalBuffer !== undefined) {
    ensureNonNegativeFinite(i.workingCapitalBuffer, "Buffer modal kerja");
  }

  ensureNonNegativeFinite(i.funding.equity, "Modal sendiri (equity)");
  const loan = i.funding.loan;
  if (loan !== undefined) {
    ensureNonNegativeFinite(loan.principal, "Pokok pinjaman");
    ensureNonNegativeFinite(loan.annualInterestRate, "Bunga pinjaman tahunan");
    ensure(Number.isInteger(loan.tenorMonths), "Tenor pinjaman harus bilangan bulat.");
    ensure(loan.tenorMonths >= 1, "Tenor pinjaman minimal 1 bulan.");
  }

  ensureFinite(i.growth.ratePerMonth, "Rate pertumbuhan");
  if (i.growth.type === "seasonal") {
    ensure(i.growth.seasonalIndices.length > 0, "Indeks musiman tidak boleh kosong.");
    for (const idx of i.growth.seasonalIndices) ensureNonNegativeFinite(idx, "Indeks musiman");
  }

  if (i.tax !== undefined) {
    ensureFinite(i.tax.rate, "Tarif pajak");
    ensure(i.tax.rate >= 0, "Tarif pajak tidak boleh negatif.");
    ensure(i.tax.rate <= 1, "Tarif pajak tidak boleh lebih dari 1 (100%).");
  }

  if (i.discountRateAnnual !== undefined) {
    ensureFinite(i.discountRateAnnual, "Discount rate tahunan");
    ensure(i.discountRateAnnual > -1, "Discount rate tahunan harus lebih dari -1.");
  }
}

/**
 * Compute the full financial model deterministically.
 * Returns unit economics, break-even, capital, monthly projections, KPIs, and warnings.
 */
export function computeFinancials(inputs: FinancialInputs): FinancialsResult {
  validateInputs(inputs);

  const currency: Currency = inputs.currency ?? "IDR";
  const price = inputs.price;
  const hppPerUnit = sumAmounts(inputs.cogsItems);
  const variablePerUnit = sumAmounts(inputs.variableCostsPerUnit);
  const fixedMonthly = sumAmounts(inputs.fixedCostsMonthly);
  const totalCapex = sumAmounts(inputs.capexItems);
  const workingCapitalBuffer = inputs.workingCapitalBuffer ?? 0;
  const startupCapital = totalCapex + workingCapitalBuffer;

  const equity = inputs.funding.equity;
  const loan = inputs.funding.loan;
  const loanPrincipal = loan?.principal ?? 0;
  const openingCash = equity + loanPrincipal - startupCapital;
  const totalInvestment = startupCapital;

  // --- Unit economics (raw values drive the math; rounded values are for display) ---
  const contribution = price - hppPerUnit - variablePerUnit;
  const contributionMarginPct = ratio(contribution, price);
  const grossMarginPct = ratio(price - hppPerUnit, price);
  const feasible = contribution > 0;

  const unitEconomics: UnitEconomics = {
    price,
    hppPerUnit: roundIDR(hppPerUnit),
    variablePerUnit: roundIDR(variablePerUnit),
    contributionMarginPerUnit: roundIDR(contribution),
    contributionMarginPct,
    grossMarginPct,
  };

  // --- Break-even (per month) ---
  const bepUnitsRaw = feasible ? fixedMonthly / contribution : null;
  const breakEven: BreakEven = {
    feasible,
    bepUnitsPerMonth: bepUnitsRaw === null ? null : roundTo(bepUnitsRaw, 2),
    bepUnitsPerMonthRounded: bepUnitsRaw === null ? null : Math.ceil(bepUnitsRaw),
    bepRevenuePerMonth: bepUnitsRaw === null ? null : roundIDR(bepUnitsRaw * price),
    bepReachedMonth: null,
  };

  // --- Monthly projections ---
  const schedule: LoanScheduleEntry[] = loan !== undefined ? amortize(loan) : [];
  const tax = inputs.tax ?? { mode: "none" as const, rate: 0 };

  const projections: MonthlyProjection[] = [];
  let cumulativeNetProfit = 0;
  let cumulativeCash = openingCash;
  let bepReachedMonth: number | null = null;
  let paybackPeriodMonths: number | null = null;
  let runwayMonths: number | null = null;

  for (let month = 1; month <= inputs.horizonMonths; month++) {
    const projected = projectUnits(inputs.volumeInitial, inputs.growth, month);
    const units = projected < 0 ? 0 : projected; // volume cannot go below zero
    // A very large growth rate over a long horizon can overflow to Infinity/NaN. Refuse to emit
    // non-finite financial numbers (PRD §9.3.5 "Sanity bounds"); demand saner inputs instead.
    if (!Number.isFinite(units)) {
      throw new FinancialInputError(
        `Proyeksi volume melebihi batas angka yang dapat dihitung (overflow) pada bulan ${month}. Turunkan rate pertumbuhan atau perpendek horizon.`,
      );
    }
    const revenue = roundIDR(units * price);
    const cogs = roundIDR(units * hppPerUnit);
    const variableCosts = roundIDR(units * variablePerUnit);
    const grossProfit = revenue - cogs;
    const fixedCosts = roundIDR(fixedMonthly);

    const entry = schedule[month - 1];
    const loanInterest = roundIDR(entry?.interest ?? 0);
    const loanPrincipalRepayment = roundIDR(entry?.principal ?? 0);

    const operatingProfit = grossProfit - variableCosts - fixedCosts;

    let taxAmount = 0;
    if (tax.mode === "final_revenue") {
      taxAmount = roundIDR(revenue * tax.rate);
    } else if (tax.mode === "income") {
      const preTax = operatingProfit - loanInterest;
      taxAmount = preTax > 0 ? roundIDR(preTax * tax.rate) : 0;
    }

    const netProfit = operatingProfit - loanInterest - taxAmount;
    const cashFlow = netProfit - loanPrincipalRepayment;

    cumulativeNetProfit += netProfit;
    cumulativeCash += cashFlow;

    if (bepReachedMonth === null && bepUnitsRaw !== null && units >= bepUnitsRaw) {
      bepReachedMonth = month;
    }
    if (paybackPeriodMonths === null && cumulativeNetProfit >= startupCapital) {
      paybackPeriodMonths = month;
    }
    if (runwayMonths === null && cumulativeCash < 0) {
      runwayMonths = month;
    }

    projections.push({
      month,
      units,
      revenue,
      cogs,
      variableCosts,
      grossProfit,
      fixedCosts,
      loanInterest,
      loanPrincipalRepayment,
      tax: taxAmount,
      operatingProfit,
      netProfit,
      cashFlow,
      cumulativeNetProfit,
      cumulativeCash,
    });
  }
  breakEven.bepReachedMonth = bepReachedMonth;

  const capital: Capital = {
    totalCapex: roundIDR(totalCapex),
    workingCapitalBuffer: roundIDR(workingCapitalBuffer),
    startupCapital: roundIDR(startupCapital),
    equity: roundIDR(equity),
    loanPrincipal: roundIDR(loanPrincipal),
    openingCash: roundIDR(openingCash),
    totalInvestment: roundIDR(totalInvestment),
  };

  // --- KPIs / returns ---
  const totalNetProfitHorizon = cumulativeNetProfit;
  const investmentSeries = [-startupCapital, ...projections.map((p) => p.netProfit)];
  const irrMonthly = irrPerPeriod(investmentSeries);
  const irrAnnualPct = irrMonthly === null ? null : monthlyToAnnualRate(irrMonthly);

  let npvValue: number | null = null;
  if (inputs.discountRateAnnual !== undefined) {
    npvValue = roundIDR(npv(annualToMonthlyRate(inputs.discountRateAnnual), investmentSeries));
  }

  const returns: Returns = {
    totalNetProfitHorizon,
    roiPct: ratio(totalNetProfitHorizon, totalInvestment),
    paybackPeriodMonths,
    npv: npvValue,
    irrAnnualPct,
    runwayMonths,
  };

  // --- Business-logic warnings (these do NOT block; the UI surfaces them) ---
  const warnings: FinancialWarning[] = [];
  if (!feasible) {
    warnings.push({
      code: "price_below_cost",
      severity: "error",
      message:
        "Harga jual lebih rendah dari biaya per unit — margin kontribusi negatif. Naikkan harga jual atau tekan biaya bahan/variabel.",
    });
  }
  if (feasible && grossMarginPct > 0.9) {
    warnings.push({
      code: "very_high_margin",
      severity: "info",
      message:
        "Margin kotor sangat tinggi (di atas 90%). Pastikan semua komponen biaya (HPP & variabel) sudah dimasukkan.",
    });
  }
  if (inputs.volumeInitial === 0) {
    warnings.push({
      code: "zero_volume",
      severity: "warning",
      message:
        "Volume penjualan awal 0 — proyeksi pendapatan akan kosong. Isi estimasi volume yang realistis.",
    });
  }
  if (inputs.growth.ratePerMonth < 0) {
    warnings.push({
      code: "negative_growth",
      severity: "info",
      message: "Model pertumbuhan menurun (rate negatif) — volume berkurang tiap bulan.",
    });
  }
  if (openingCash < 0) {
    warnings.push({
      code: "funding_gap",
      severity: "warning",
      message:
        "Sumber dana (modal sendiri + pinjaman) lebih kecil dari modal awal yang dibutuhkan. Tambah modal atau kurangi kebutuhan awal.",
    });
  }
  if (feasible && bepReachedMonth === null) {
    warnings.push({
      code: "bep_not_reached",
      severity: "warning",
      message: "Volume penjualan belum mencapai titik impas (BEP) dalam horizon proyeksi.",
    });
  }
  if (paybackPeriodMonths === null) {
    warnings.push({
      code: "payback_exceeds_horizon",
      severity: "info",
      message: "Modal awal belum kembali (payback) dalam horizon proyeksi yang dipilih.",
    });
  }
  if (totalNetProfitHorizon < 0) {
    warnings.push({
      code: "loss_making_horizon",
      severity: "warning",
      message:
        "Akumulasi laba bersih selama horizon masih negatif (rugi). Tinjau kembali harga, biaya, atau volume.",
    });
  }

  return { currency, unitEconomics, breakEven, capital, projections, returns, warnings };
}
