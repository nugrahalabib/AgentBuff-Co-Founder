"use client";

import { useState } from "react";
import { AppHeader } from "@/ui/app-header";
import { Button } from "@/ui/button";

type DocType = "proposal" | "pitch_deck";

const STRUCTURE: Record<DocType, string[]> = {
  proposal: [
    "Ringkasan Eksekutif",
    "Latar Belakang & Masalah",
    "Solusi / Deskripsi Usaha",
    "Analisis Pasar",
    "Strategi Pemasaran",
    "Rencana Operasional",
    "Struktur Tim",
    "Rencana Keuangan (tabel + KPI)",
    "Analisis Risiko & Mitigasi",
    "Roadmap",
    "Penutup & Lampiran",
  ],
  pitch_deck: [
    "Cover",
    "Problem",
    "Solution",
    "Why Now",
    "Market (TAM/SAM/SOM)",
    "Product",
    "Business Model",
    "GTM / Traction",
    "Competition / Moat",
    "Team",
    "Financials",
    "The Ask",
  ],
};

const TEMPLATES = ["Minimalis", "Korporat", "Kreatif"];

export default function DocsPage() {
  const [type, setType] = useState<DocType>("proposal");
  const [template, setTemplate] = useState(TEMPLATES[0]!);
  const isDeck = type === "pitch_deck";

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl sm:text-3xl">Deck & Docs Engine</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Merakit seluruh data project menjadi dokumen investor-grade. Angka diikat dari Financial Engine (tidak
          dikarang); HTML/CSS terkendali template → PDF via Paged.js + headless Chromium.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Jenis dokumen</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["proposal", "pitch_deck"] as DocType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`cursor-pointer rounded-card border p-3 text-left text-sm transition-colors ${
                    type === t ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="font-semibold">{t === "proposal" ? "Business Proposal" : "Pitch Deck"}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t === "proposal" ? "A4 portrait, formal" : "16:9 landscape, investor"}
                  </span>
                </button>
              ))}
            </div>

            <h2 className="mt-5 text-sm font-semibold">Template</h2>
            <div className="mt-3 flex gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                    template === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <h2 className="mt-5 text-sm font-semibold">{isDeck ? "Slide" : "Bagian"}</h2>
            <ol className="mt-3 space-y-1.5">
              {STRUCTURE[type].map((s, i) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>

            <a href="/onboarding" className="mt-5 block">
              <Button size="lg" className="w-full">
                Generate {isDeck ? "Pitch Deck" : "Proposal"} (butuh API key)
              </Button>
            </a>
          </section>

          {/* Preview placeholder */}
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Pratinjau</h2>
            <div className="mt-3 flex items-center justify-center rounded-card bg-muted/40 p-6">
              <div
                className={`flex items-center justify-center rounded-lg border border-dashed border-border bg-surface text-center text-xs text-muted-foreground ${
                  isDeck ? "aspect-video w-full" : "aspect-[1/1.414] w-2/3"
                }`}
              >
                <span className="px-6">
                  {template} · {isDeck ? "16:9 landscape" : "A4 portrait"}
                  <br />
                  Pratinjau muncul setelah generate
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Brand tokens (warna &amp; tipografi) dari Brand Kit menjadi tema dokumen; gambar &amp; angka disisipkan otomatis.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
