"use client";

import { useState } from "react";
import { AppHeader } from "@/ui/app-header";
import { computeValidationScore } from "@/server/engine/research/index";

const REC = {
  go: { label: "Go — layak dilanjutkan", cls: "text-accent", bar: "bg-accent" },
  refine: { label: "Refine — perlu disempurnakan", cls: "text-warning", bar: "bg-warning" },
  reconsider: { label: "Reconsider — pertimbangkan pivot", cls: "text-destructive", bar: "bg-destructive" },
} as const;

const SIGNALS = [
  { key: "demandStrength", label: "Kekuatan permintaan", help: "Seberapa besar & kuat sinyal permintaan pasar." },
  { key: "marginHeadroom", label: "Ruang margin", help: "(harga − biaya) / harga — potensi untung." },
  { key: "competitionGap", label: "Celah kompetisi", help: "1 − tingkat kejenuhan pasar." },
  { key: "differentiation", label: "Diferensiasi", help: "Keunikan vs kelemahan kompetitor." },
] as const;

type SignalKey = (typeof SIGNALS)[number]["key"];

export default function ResearchPage() {
  const [vals, setVals] = useState<Record<SignalKey, number>>({
    demandStrength: 70,
    marginHeadroom: 60,
    competitionGap: 55,
    differentiation: 50,
  });
  const [penalty, setPenalty] = useState(0);

  // Deterministic score, computed live client-side (same engine as the server). PRD §9.2.4, §9.3.9.
  const score = computeValidationScore({
    demandStrength: vals.demandStrength / 100,
    marginHeadroom: vals.marginHeadroom / 100,
    competitionGap: vals.competitionGap / 100,
    differentiation: vals.differentiation / 100,
    regulatoryPenalty: penalty / 100,
  });
  const rec = REC[score.recommendation];

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl sm:text-3xl">Validasi Ide</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Skor kelayakan (0–100) dihitung deterministik dari sinyal terstruktur — bukan dikarang AI. Dalam alur penuh,
          sinyal di bawah diisi dari <strong>riset pasar tergrounding</strong> (dengan sumber yang bisa diklik) memakai
          API key-mu. Di sini kamu bisa mengutak-atiknya untuk memahami skornya.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Signal controls */}
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Sinyal terstruktur</h2>
            <div className="mt-4 space-y-5">
              {SIGNALS.map((s) => (
                <Slider
                  key={s.key}
                  label={s.label}
                  help={s.help}
                  value={vals[s.key]}
                  onChange={(v) => setVals((prev) => ({ ...prev, [s.key]: v }))}
                />
              ))}
              <Slider label="Penalti regulasi" help="Izin berat yang belum terpenuhi (mengurangi skor)." value={penalty} onChange={setPenalty} tone="bad" />
            </div>
          </section>

          {/* Score */}
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Skor Validasi</h2>
            <div className="mt-4 flex items-end gap-3">
              <span className={`font-display text-6xl tabular-nums ${rec.cls}`}>{score.score}</span>
              <span className="pb-2 text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className={`mt-1 text-sm font-semibold ${rec.cls}`}>{rec.label}</p>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Rincian kontribusi</p>
              {[
                ["Permintaan", score.breakdown.demand, 35],
                ["Margin", score.breakdown.margin, 30],
                ["Kompetisi", score.breakdown.competition, 20],
                ["Diferensiasi", score.breakdown.differentiation, 15],
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
              {score.breakdown.regulatoryPenalty > 0 && (
                <p className="text-xs text-destructive">− {score.breakdown.regulatoryPenalty} penalti regulasi</p>
              )}
            </div>

            <a href="/onboarding" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
              Tautkan API key untuk riset tergrounding otomatis →
            </a>
          </section>
        </div>
      </main>
    </div>
  );
}

function Slider({
  label,
  help,
  value,
  onChange,
  tone = "default",
}: {
  label: string;
  help: string;
  value: number;
  onChange: (v: number) => void;
  tone?: "default" | "bad";
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className={`text-sm tabular-nums ${tone === "bad" ? "text-destructive" : "text-primary"}`}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full cursor-pointer accent-[var(--color-primary)]"
      />
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
