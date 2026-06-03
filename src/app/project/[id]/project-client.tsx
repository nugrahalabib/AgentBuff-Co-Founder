"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/ui/button";
import { CashFlowChart } from "@/ui/cash-flow-chart";
import type { BusinessPlan, ResearchReport } from "@/server/domain/types";
import type { FinancialInputs, ScenarioKpis, ScenarioSummarySet } from "@/server/engine/financial/index";

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

const RESEARCH_STAGES: { key: string; label: string }[] = [
  { key: "normalize", label: "Merapikan ide" },
  { key: "demand", label: "Menganalisis permintaan pasar" },
  { key: "competitor", label: "Memeriksa kompetitor" },
  { key: "pricing", label: "Membandingkan harga & biaya" },
  { key: "risk", label: "Menilai risiko & regulasi" },
  { key: "score", label: "Menghitung skor" },
  { key: "synthesis", label: "Menyusun laporan" },
];
const RISK_LABEL: Record<string, string> = {
  regulatory: "Regulasi", market: "Pasar", operational: "Operasional", financial: "Finansial", other: "Lainnya",
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
  const [stages, setStages] = useState<Record<string, "start" | "done">>({});

  const setField = (k: keyof PlanForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));

  async function runValidation() {
    setBusy("validate");
    setError("");
    setStages({});
    try {
      const res = await fetch(`/api/projects/${projectId}/validate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok || res.body === null) {
        setError("Gagal memulai validasi.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const ev = parseSse(part);
          if (ev === null) continue;
          if (ev.event === "stage") {
            const s = ev.data as { stage: string; status: "start" | "done" };
            setStages((prev) => ({ ...prev, [s.stage]: s.status }));
          } else if (ev.event === "done") {
            setResearch((ev.data as { report: ResearchReport }).report);
          } else if (ev.event === "error") {
            const d = ev.data as { error: string };
            setError(d.error);
          }
        }
      }
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
            <Link href="/pengaturan" className="font-semibold underline">
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
        {busy === "validate" ? (
          <ResearchStepper stages={stages} />
        ) : research === null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Riset pasar tergrounding memakai API key-mu (permintaan → kompetitor → harga → risiko), lalu skor kelayakan
            dihitung deterministik. Setiap klaim menampilkan sumber yang bisa diklik; yang tanpa sumber ditandai
            &ldquo;estimasi&rdquo;.
          </p>
        ) : (
          <ResearchReportView report={research} />
        )}
      </section>

      {/* Plan */}
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">2 · Business Plan</h2>
          {plan?.stale === true && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning" title="Riset diperbarui — susun ulang plan agar konsisten">
              Perlu diperbarui
            </span>
          )}
        </div>
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

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Proyeksi kas kumulatif &amp; laba bersih</p>
              <CashFlowChart projections={plan.financials.projections} />
            </div>

            {plan.scenarios !== undefined && <PlanScenarios scenarios={plan.scenarios} />}
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
            <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
              Angka di atas dihitung engine deterministik dari asumsimu — <strong>estimasi</strong>, bukan jaminan hasil
              maupun nasihat finansial profesional. Narasi disusun AI dengan angka yang sama (tidak mengarang angka).
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function PlanScenarios({ scenarios }: { scenarios: ScenarioSummarySet }) {
  const cols: { key: keyof ScenarioSummarySet; tone: string }[] = [
    { key: "pessimistic", tone: "text-destructive" },
    { key: "realistic", tone: "text-foreground" },
    { key: "optimistic", tone: "text-accent" },
  ];
  const rows: { label: string; get: (s: ScenarioKpis) => string }[] = [
    { label: "Payback", get: (s) => (s.paybackPeriodMonths === null ? "> horizon" : `${s.paybackPeriodMonths} bln`) },
    { label: "ROI", get: (s) => pct(s.roiPct) },
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

function parseSse(chunk: string): { event: string; data: unknown } | null {
  let event = "message";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (data === "") return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

function ResearchStepper({ stages }: { stages: Record<string, "start" | "done"> }) {
  return (
    <ul className="mt-4 space-y-2">
      {RESEARCH_STAGES.map((s) => {
        const st = stages[s.key];
        return (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                st === "done" ? "bg-accent text-on-accent" : st === "start" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {st === "done" ? "✓" : st === "start" ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> : "•"}
            </span>
            <span className={st === undefined ? "text-muted-foreground" : ""}>{s.label}…</span>
          </li>
        );
      })}
    </ul>
  );
}

function SourceChip({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-primary hover:bg-muted"
    >
      <img src={`https://www.google.com/s2/favicons?domain=${hostOf(url)}&sz=32`} alt="" className="h-3.5 w-3.5 rounded-sm" />
      {hostOf(url)} ↗
    </a>
  );
}

function ResearchReportView({ report }: { report: ResearchReport }) {
  return (
    <div className="mt-4 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-4xl tabular-nums">{report.validationScore}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REC[report.recommendation]?.cls ?? ""}`}>
          {REC[report.recommendation]?.label ?? report.recommendation}
        </span>
        {!report.isGrounded && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" title="Tanpa sumber tergrounding">
            estimasi
          </span>
        )}
        {report.isGrounded && report.groundingQueryCount !== undefined && (
          <span className="text-xs text-muted-foreground">{report.groundingQueryCount} kueri tergrounding</span>
        )}
      </div>

      {/* Score breakdown (transparency, §9.2.4) */}
      <div className="space-y-1.5">
        {[
          ["Permintaan", report.scoreBreakdown.demand, 35],
          ["Margin", report.scoreBreakdown.margin, 30],
          ["Kompetisi", report.scoreBreakdown.competition, 20],
          ["Diferensiasi", report.scoreBreakdown.differentiation, 15],
        ].map(([label, val, max]) => (
          <div key={label as string}>
            <div className="flex justify-between text-xs">
              <span>{label}</span>
              <span className="tabular-nums text-muted-foreground">{val} / {max}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${((val as number) / (max as number)) * 100}%` }} />
            </div>
          </div>
        ))}
        {report.scoreBreakdown.regulatoryPenalty > 0 && (
          <p className="text-xs text-destructive">− {report.scoreBreakdown.regulatoryPenalty} penalti regulasi</p>
        )}
      </div>

      {report.summary !== undefined && report.summary !== "" && (
        <p className="text-sm text-muted-foreground">{report.summary}</p>
      )}
      {report.recommendationReason !== undefined && report.recommendationReason !== "" && (
        <p className="rounded-card border border-border bg-muted/30 p-3 text-sm">{report.recommendationReason}</p>
      )}

      {/* Competitors */}
      {report.competitors !== undefined && report.competitors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Kompetitor ({report.competitors.length})</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {report.competitors.map((c, i) => (
              <div key={i} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {c.priceRange !== undefined && <span className="text-xs text-muted-foreground">{c.priceRange}</span>}
                </div>
                {c.positioning !== undefined && <p className="mt-1 text-xs text-muted-foreground">{c.positioning}</p>}
                {c.sourceUrl !== undefined && <div className="mt-1.5"><SourceChip url={c.sourceUrl} /></div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      {report.pricing !== undefined && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-border p-3 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Kisaran harga pasar:</span>
          <span className="tabular-nums">{idr(report.pricing.min)} – {idr(report.pricing.max)}</span>
          <span className="tabular-nums text-muted-foreground">median {idr(report.pricing.median)}</span>
        </div>
      )}

      {/* Risks */}
      {report.risks !== undefined && report.risks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Risiko</p>
          <ul className="space-y-1.5">
            {report.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{RISK_LABEL[r.category] ?? r.category}</span>
                <span className="flex-1">
                  {r.description}
                  {r.mitigation !== undefined && <span className="text-muted-foreground"> — mitigasi: {r.mitigation}</span>}
                </span>
                <span className="text-xs text-warning">sev {r.severity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resources */}
      {report.resources !== undefined && report.resources.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Sumber daya</p>
          <div className="flex flex-wrap gap-1.5">
            {report.resources.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-primary hover:bg-muted">
                {r.label} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* All sources */}
      {report.sources.length > 0 && (
        <details className="rounded-card border border-border bg-surface p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Semua Sumber ({report.sources.length})</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.sources.map((s, i) => (
              <SourceChip key={i} url={s.url} />
            ))}
          </div>
        </details>
      )}
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
