"use client";

import { useState } from "react";
import { AppHeader } from "@/ui/app-header";
import { Button } from "@/ui/button";
import { CashFlowChart } from "@/ui/cash-flow-chart";
import type { FinancialsResult, ScenarioKpis, ScenarioSummarySet } from "@/server/engine/financial/index";

type FinancialsResponse = FinancialsResult & { scenarios?: ScenarioSummarySet };

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface Form {
  price: number;
  variable: number;
  fixed: number;
  capex: number;
  working: number;
  volume: number;
  growth: number; // %/month
  horizon: number;
  discount: number; // %/year
}

const DEFAULTS: Form = {
  price: 20000,
  variable: 10000,
  fixed: 5000000,
  capex: 10000000,
  working: 5000000,
  volume: 600,
  growth: 0,
  horizon: 24,
  discount: 10,
};

export default function CalculatorPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [result, setResult] = useState<FinancialsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));

  async function calculate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricing: { unit_price: form.price },
          costs: {
            variable_cost_per_unit: form.variable,
            fixed_costs_monthly: form.fixed,
            initial_capex: form.capex,
            working_capital: form.working,
          },
          assumptions: {
            monthly_volume: form.volume,
            growth_rate_monthly: form.growth / 100,
            horizon_months: form.horizon,
            discount_rate_annual: form.discount / 100,
          },
        }),
      });
      const data = (await res.json()) as FinancialsResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Gagal menghitung.");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader active="kalkulator" />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl sm:text-3xl">Kalkulator Keuangan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Semua angka dihitung oleh engine deterministik — bukan dikarang AI. Ubah input untuk skenario what-if.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          {/* Inputs */}
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Input bisnis (IDR)</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Harga jual / unit" value={form.price} onChange={set("price")} />
              <Field label="Biaya variabel / unit" value={form.variable} onChange={set("variable")} />
              <Field label="Biaya tetap / bulan" value={form.fixed} onChange={set("fixed")} />
              <Field label="Modal awal (peralatan)" value={form.capex} onChange={set("capex")} />
              <Field label="Modal kerja" value={form.working} onChange={set("working")} />
              <Field label="Volume / bulan (unit)" value={form.volume} onChange={set("volume")} />
              <Field label="Pertumbuhan / bulan (%)" value={form.growth} onChange={set("growth")} />
              <Field label="Diskonto / tahun (%)" value={form.discount} onChange={set("discount")} />
              <label className="text-sm">
                <span className="text-muted-foreground">Horizon</span>
                <select
                  value={form.horizon}
                  onChange={set("horizon")}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  {[12, 24, 36].map((h) => (
                    <option key={h} value={h}>
                      {h} bulan
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button onClick={calculate} disabled={loading} size="lg" className="mt-5 w-full">
              {loading ? "Menghitung…" : "Hitung Keuangan"}
            </Button>
            {error !== "" && (
              <p className="mt-3 rounded-card border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </section>

          {/* Results */}
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Hasil</h2>
            {result === null ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Isi input lalu tekan &ldquo;Hitung Keuangan&rdquo; untuk melihat margin, BEP, payback, ROI, dan proyeksi.
              </p>
            ) : (
              <Results result={result} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={onChange}
        className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  const color = tone === "good" ? "text-accent" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Results({ result }: { result: FinancialsResponse }) {
  const { unitEconomics: ue, breakEven: be, capital: cap, returns: ret, projections, warnings, scenarios } = result;
  const preview = projections.filter((_, i) => i < 6 || i === projections.length - 1);

  return (
    <div className="mt-4 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Margin kontribusi/unit" value={idr(ue.contributionMarginPerUnit)} tone={ue.contributionMarginPerUnit > 0 ? "good" : "bad"} />
        <Kpi label="Margin kotor" value={pct(ue.grossMarginPct)} />
        <Kpi label="BEP / bulan" value={be.bepUnitsPerMonth === null ? "—" : `${be.bepUnitsPerMonthRounded} unit`} />
        <Kpi label="Modal awal" value={idr(cap.startupCapital)} />
        <Kpi label="Payback" value={ret.paybackPeriodMonths === null ? "> horizon" : `${ret.paybackPeriodMonths} bln`} />
        <Kpi label="ROI (horizon)" value={pct(ret.roiPct)} tone={ret.roiPct > 0 ? "good" : "bad"} />
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((w) => (
            <li
              key={w.code}
              className={`rounded-xl border p-2.5 text-xs ${
                w.severity === "error"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : w.severity === "warning"
                    ? "border-warning/30 bg-warning/5 text-warning"
                    : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              {w.message}
            </li>
          ))}
        </ul>
      )}

      {/* Cash-flow / profit chart (deterministic, plotted from engine output). PRD §9.3.9 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Proyeksi kas kumulatif &amp; laba bersih</p>
        <CashFlowChart projections={projections} />
      </div>

      {/* Scenario comparison. PRD §9.3.9 */}
      {scenarios !== undefined && <ScenarioTable scenarios={scenarios} />}

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left">Bulan</th>
              <th className="px-2 py-1.5">Pendapatan</th>
              <th className="px-2 py-1.5">Laba bersih</th>
              <th className="px-2 py-1.5">Kas kumulatif</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((m) => (
              <tr key={m.month} className="border-b border-border/50">
                <td className="px-2 py-1.5 text-left">{m.month}</td>
                <td className="px-2 py-1.5">{idr(m.revenue)}</td>
                <td className={`px-2 py-1.5 ${m.netProfit < 0 ? "text-destructive" : ""}`}>{idr(m.netProfit)}</td>
                <td className={`px-2 py-1.5 ${m.cumulativeCash < 0 ? "text-destructive" : ""}`}>{idr(m.cumulativeCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimasi berbasis asumsi — bukan jaminan, bukan nasihat finansial profesional.
      </p>
    </div>
  );
}

function ScenarioTable({ scenarios }: { scenarios: ScenarioSummarySet }) {
  const cols: { key: keyof ScenarioSummarySet; tone: string }[] = [
    { key: "pessimistic", tone: "text-destructive" },
    { key: "realistic", tone: "text-foreground" },
    { key: "optimistic", tone: "text-accent" },
  ];
  const rows: { label: string; get: (s: ScenarioKpis) => string }[] = [
    { label: "BEP / bulan", get: (s) => (s.bepUnitsPerMonthRounded === null ? "—" : `${s.bepUnitsPerMonthRounded} unit`) },
    { label: "Payback", get: (s) => (s.paybackPeriodMonths === null ? "> horizon" : `${s.paybackPeriodMonths} bln`) },
    { label: "ROI (horizon)", get: (s) => pct(s.roiPct) },
    { label: "Laba total", get: (s) => idr(s.totalNetProfitHorizon) },
    { label: "Kas akhir", get: (s) => idr(s.finalCumulativeCash) },
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Skenario (deterministik)</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-right text-xs tabular-nums">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Metrik</th>
              {cols.map((c) => (
                <th key={c.key} className={`px-2 py-1.5 font-semibold ${c.tone}`}>
                  {scenarios[c.key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border/50">
                <td className="px-2 py-1.5 text-left text-muted-foreground">{r.label}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    {r.get(scenarios[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
