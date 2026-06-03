"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/ui/button";
import type { BusinessPlan, ResearchReport } from "@/server/domain/types";
import type { FinancialInputs } from "@/server/engine/financial/index";

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const REC: Record<string, { label: string; cls: string }> = {
  go: { label: "Go", cls: "bg-accent/10 text-accent" },
  refine: { label: "Refine", cls: "bg-warning/10 text-warning" },
  reconsider: { label: "Reconsider", cls: "bg-destructive/10 text-destructive" },
};

const NARRATIVE_LABELS: Record<string, string> = {
  execSummary: "Ringkasan Eksekutif",
  businessDesc: "Deskripsi Usaha",
  marketAnalysis: "Analisis Pasar",
  marketingStrategy: "Strategi Pemasaran",
  funnel: "Funnel",
  operations: "Operasional",
  team: "Tim",
  financialPlan: "Rencana Keuangan",
  roadmap: "Roadmap",
  risks: "Risiko & Mitigasi",
  closing: "Penutup",
};

interface PlanForm {
  price: number;
  variable: number;
  fixed: number;
  capex: number;
  working: number;
  volume: number;
  growth: number;
  horizon: number;
}
const PLAN_DEFAULTS: PlanForm = { price: 20000, variable: 10000, fixed: 5000000, capex: 10000000, working: 5000000, volume: 600, growth: 0, horizon: 12 };

export function ProjectClient({
  projectId,
  title,
  ideaText,
  initialResearch,
  initialPlan,
}: {
  projectId: string;
  title: string;
  ideaText: string;
  initialResearch: ResearchReport | null;
  initialPlan: BusinessPlan | null;
}) {
  const [research, setResearch] = useState<ResearchReport | null>(initialResearch);
  const [plan, setPlan] = useState<BusinessPlan | null>(initialPlan);
  const [form, setForm] = useState<PlanForm>(PLAN_DEFAULTS);
  const [busy, setBusy] = useState<"validate" | "plan" | null>(null);
  const [error, setError] = useState("");

  const setField = (k: keyof PlanForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));

  async function runValidation() {
    setBusy("validate");
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { report?: ResearchReport; error?: string };
      if (!res.ok || data.report === undefined) setError(data.error ?? "Gagal validasi.");
      else setResearch(data.report);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  async function runPlan() {
    setBusy("plan");
    setError("");
    const inputs: FinancialInputs = {
      modelType: "physical",
      price: form.price,
      cogsItems: [],
      variableCostsPerUnit: form.variable > 0 ? [{ label: "variable", amount: form.variable }] : [],
      fixedCostsMonthly: form.fixed > 0 ? [{ label: "fixed", amount: form.fixed }] : [],
      capexItems: form.capex > 0 ? [{ label: "capex", amount: form.capex }] : [],
      workingCapitalBuffer: form.working,
      volumeInitial: form.volume,
      growth: { type: "compound", ratePerMonth: form.growth / 100 },
      funding: { equity: form.capex + form.working },
      horizonMonths: form.horizon,
    };
    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financial_inputs: inputs }),
      });
      const data = (await res.json()) as { plan?: BusinessPlan; error?: string };
      if (!res.ok || data.plan === undefined) setError(data.error ?? "Gagal menyusun plan.");
      else setPlan(data.plan);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ideaText}</p>
      </div>

      {error !== "" && (
        <p className="rounded-card border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}{" "}
          {error.includes("key") && (
            <Link href="/onboarding" className="font-semibold underline">
              Tautkan sekarang
            </Link>
          )}
        </p>
      )}

      {/* Validation */}
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">1 · Validasi Ide</h2>
          <Button onClick={runValidation} disabled={busy !== null} size="md">
            {busy === "validate" ? "Meriset…" : research ? "Riset ulang" : "Jalankan Validasi (AI)"}
          </Button>
        </div>
        {research === null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Riset pasar tergrounding memakai API key-mu, lalu skor kelayakan dihitung deterministik.
          </p>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <span className="font-display text-4xl tabular-nums">{research.validationScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REC[research.recommendation]?.cls ?? ""}`}>
                {REC[research.recommendation]?.label ?? research.recommendation}
              </span>
              {!research.isGrounded && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">estimasi</span>
              )}
            </div>
            {research.summary !== undefined && research.summary !== "" && (
              <p className="mt-3 text-sm text-muted-foreground">{research.summary}</p>
            )}
            {research.sources.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Sumber</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {research.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-primary hover:bg-muted"
                    >
                      {hostOf(s.url)} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Plan */}
      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">2 · Business Plan</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PlanField label="Harga/unit" value={form.price} onChange={setField("price")} />
          <PlanField label="Biaya var/unit" value={form.variable} onChange={setField("variable")} />
          <PlanField label="Biaya tetap/bln" value={form.fixed} onChange={setField("fixed")} />
          <PlanField label="Modal awal" value={form.capex} onChange={setField("capex")} />
          <PlanField label="Modal kerja" value={form.working} onChange={setField("working")} />
          <PlanField label="Volume/bln" value={form.volume} onChange={setField("volume")} />
          <PlanField label="Tumbuh %/bln" value={form.growth} onChange={setField("growth")} />
          <PlanField label="Horizon (bln)" value={form.horizon} onChange={setField("horizon")} />
        </div>
        <Button onClick={runPlan} disabled={busy !== null} className="mt-4">
          {busy === "plan" ? "Menyusun…" : "Susun Plan (angka deterministik + narasi AI)"}
        </Button>

        {plan !== null && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Margin kontribusi" value={idr(plan.financials.unitEconomics.contributionMarginPerUnit)} />
              <Kpi label="BEP/bln" value={plan.financials.breakEven.bepUnitsPerMonthRounded === null ? "—" : `${plan.financials.breakEven.bepUnitsPerMonthRounded} unit`} />
              <Kpi label="Payback" value={plan.financials.returns.paybackPeriodMonths === null ? "> horizon" : `${plan.financials.returns.paybackPeriodMonths} bln`} />
              <Kpi label="ROI" value={pct(plan.financials.returns.roiPct)} />
            </div>
            {plan.narrative !== undefined && (
              <div className="space-y-3">
                {Object.entries(plan.narrative).map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-sm font-semibold">{NARRATIVE_LABELS[k] ?? k}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PlanField({ label, value, onChange }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={onChange}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm tabular-nums outline-none focus:border-primary"
      />
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
