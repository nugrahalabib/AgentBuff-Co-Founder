"use client";

import { useState } from "react";

// Just-in-time glossary for business jargon. PRD §14.8 — tap a term to reveal a plain-Bahasa definition
// + example, so beginners are never left guessing. Add terms here; reference them with <Term k="..."/>.
export const GLOSSARY: Record<string, { label: string; def: string; example?: string }> = {
  hpp: {
    label: "HPP",
    def: "Harga Pokok Produksi — total biaya membuat satu unit (bahan + tenaga langsung).",
    example: "Kopi: biji + susu + gelas = Rp8.000/cup.",
  },
  bep: {
    label: "BEP",
    def: "Break-Even Point / titik impas — jumlah penjualan agar pendapatan = biaya (belum untung, belum rugi).",
    example: "BEP 400 cup/bulan → di atas itu baru untung.",
  },
  margin: {
    label: "Margin",
    def: "Selisih harga jual dan biaya, dibagi harga jual — seberapa besar 'sisa' dari tiap penjualan.",
  },
  "contribution-margin": {
    label: "Margin kontribusi",
    def: "Harga jual − biaya variabel per unit. Inilah yang menutup biaya tetap; sisanya jadi laba.",
  },
  roi: {
    label: "ROI",
    def: "Return on Investment — persentase keuntungan dibanding modal yang kamu tanam.",
    example: "Modal Rp10jt, untung Rp4jt → ROI 40%.",
  },
  payback: {
    label: "Payback",
    def: "Periode balik modal — berapa bulan sampai keuntungan menutup modal awal.",
  },
  tam: {
    label: "TAM",
    def: "Total Addressable Market — total potensi pasar bila semua calon pembeli membeli.",
  },
  npv: {
    label: "NPV",
    def: "Net Present Value — nilai sekarang dari arus kas masa depan setelah didiskon (uang masa depan < uang sekarang).",
  },
};

/** Definition lookup (pure) — used by the UI and unit-tested. */
export function glossaryDef(key: string): { label: string; def: string; example?: string } | null {
  return GLOSSARY[key] ?? null;
}

/** A glossary term: dotted underline; tap/click toggles a plain-language popover. */
export function Term({ k, children }: { k: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[k];
  if (entry === undefined) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"
        aria-expanded={open}
      >
        {children ?? entry.label}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1 block w-64 rounded-xl border border-border bg-surface p-3 text-left text-xs font-normal shadow-lg"
        >
          <span className="block font-semibold text-foreground">{entry.label}</span>
          <span className="mt-1 block text-muted-foreground">{entry.def}</span>
          {entry.example !== undefined && (
            <span className="mt-1 block text-muted-foreground/80">Contoh: {entry.example}</span>
          )}
        </span>
      )}
    </span>
  );
}
