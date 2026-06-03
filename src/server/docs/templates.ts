// src/server/docs/templates.ts — deterministic HTML renderers for proposal (A4) + pitch deck (16:9).
// PRD §9.5. Every LLM slot is HTML-escaped (sanitize.ts); every number is bound from the engine. Output
// is a self-contained HTML doc with inline <style> + native CSS @page pagination (no external scripts →
// stays within the strict CSP). The headless-Chromium worker can layer Paged.js later for richer print.

import type { BoundFinancials, BusinessDocument, PitchDeckSlots, ProposalSlots, SourceRef } from "../domain/types";
import { escapeHtml, escapeMultiline, safeUrl } from "@/lib/html/sanitize";

const idr = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

interface Theme {
  accent: string;
  ink: string;
}
const THEMES: Record<string, Theme> = {
  indigo: { accent: "#6366F1", ink: "#1e1b2e" },
  emerald: { accent: "#10b981", ink: "#06281f" },
  amber: { accent: "#d97706", ink: "#3a2606" },
};
const themeOf = (name?: string): Theme => THEMES[name ?? "indigo"] ?? THEMES["indigo"]!;

function financialsTable(b: BoundFinancials): string {
  const rows: [string, string][] = [
    ["Margin kontribusi / unit", idr(b.contributionMarginPerUnit)],
    ["Margin kotor", pct(b.grossMarginPct)],
    ["BEP / bulan", b.bepUnitsPerMonth === null ? "—" : `${b.bepUnitsPerMonth} unit`],
    ["Modal awal", idr(b.startupCapital)],
    ["Payback", b.paybackMonths === null ? "> horizon" : `${b.paybackMonths} bulan`],
    ["ROI (horizon)", pct(b.roiPct)],
  ];
  return `<table class="fin">${rows
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`;
}

function sourcesBlock(sources?: SourceRef[]): string {
  if (sources === undefined || sources.length === 0) return "";
  const chips = sources
    .map((s) => `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener">${escapeHtml(hostOf(s.url))}</a>`)
    .join("");
  return `<section class="sources"><h2>Sumber</h2><div class="chips">${chips}</div></section>`;
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/]+)/i.exec(url);
  return m !== null ? m[1]!.replace(/^www\./, "") : url;
}

const BASE_CSS = (t: Theme): string => `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: ${t.ink}; margin: 0; line-height: 1.5; }
  h1,h2,h3 { color: ${t.ink}; margin: 0 0 .35em; }
  a { color: ${t.accent}; }
  .accent { color: ${t.accent}; }
  table.fin { border-collapse: collapse; width: 100%; margin: 8px 0 4px; font-size: 12px; }
  table.fin th, table.fin td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
  table.fin th { background: #f8fafc; font-weight: 600; width: 55%; }
  .chips a { display: inline-block; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 10px; margin: 3px 6px 0 0; font-size: 11px; text-decoration: none; }
  @media print { .no-print { display: none !important; } }
`;

const PRINT_BAR = `<div class="no-print" style="position:sticky;top:0;background:#111;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font:14px sans-serif;">
  <span>Pratinjau dokumen — gunakan "Cetak / Simpan sebagai PDF".</span>
  <button onclick="window.print()" style="background:#fff;color:#111;border:0;border-radius:999px;padding:6px 14px;font-weight:600;cursor:pointer;">Cetak / Simpan PDF</button>
</div>`;

function renderProposal(doc: BusinessDocument): string {
  const t = themeOf(doc.theme);
  const s = doc.slots as ProposalSlots;
  const section = (title: string, body: string): string =>
    `<section class="block"><h2>${escapeHtml(title)}</h2><p>${escapeMultiline(body)}</p></section>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  ${BASE_CSS(t)}
  .cover { min-height: 60vh; display: flex; flex-direction: column; justify-content: center; border-bottom: 4px solid ${t.accent}; padding-bottom: 24px; margin-bottom: 24px; }
  .cover h1 { font-size: 34px; }
  .cover .tag { font-size: 16px; color: #555; }
  .block { page-break-inside: avoid; margin: 0 0 18px; }
  .wrap { max-width: 800px; margin: 0 auto; padding: 24px; }
</style></head><body>
${PRINT_BAR}
<div class="wrap">
  <div class="cover">
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="tag accent">${escapeHtml(s.tagline)}</p>
  </div>
  ${section("Masalah", s.problem)}
  ${section("Solusi", s.solution)}
  ${section("Analisis Pasar", s.marketAnalysis)}
  ${section("Model Bisnis", s.businessModel)}
  ${section("Strategi Pemasaran", s.marketingPlan)}
  ${section("Tim", s.team)}
  <section class="block"><h2>Sorotan Finansial</h2><p>${escapeMultiline(s.financialHighlights)}</p>${financialsTable(doc.boundFinancials)}<p style="font-size:11px;color:#777">Angka dihitung engine deterministik — estimasi, bukan jaminan.</p></section>
  ${section("Kebutuhan Pendanaan", s.fundingAsk)}
  ${section("Penutup", s.closing)}
  ${sourcesBlock(doc.sources)}
</div></body></html>`;
}

function renderDeck(doc: BusinessDocument): string {
  const t = themeOf(doc.theme);
  const deck = doc.slots as PitchDeckSlots;
  const slides = deck.slides
    .map(
      (sl, i) => `<section class="slide">
      <div class="num">${i + 1} / ${deck.slides.length}</div>
      <h2>${escapeHtml(sl.title)}</h2>
      <ul>${sl.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </section>`,
    )
    .join("");
  const finSlide = `<section class="slide">
      <div class="num">Finansial</div>
      <h2>Ringkasan Finansial</h2>
      ${financialsTable(doc.boundFinancials)}
      <p style="font-size:11px;color:#777">Angka dari engine deterministik — estimasi.</p>
    </section>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>
  @page { size: 1280px 720px; margin: 0; }
  ${BASE_CSS(t)}
  body { background: #0f172a; }
  .slide { width: 1280px; min-height: 720px; margin: 16px auto; background: #fff; padding: 64px 72px; page-break-after: always; position: relative; display: flex; flex-direction: column; justify-content: center; }
  .slide h2 { font-size: 40px; border-left: 6px solid ${t.accent}; padding-left: 18px; }
  .slide ul { font-size: 22px; line-height: 1.8; }
  .slide .num { position: absolute; top: 32px; right: 48px; color: ${t.accent}; font-weight: 700; }
  .slide:first-of-type h2 { font-size: 56px; }
</style></head><body>
${PRINT_BAR}
<section class="slide"><div class="num">AgentBuff</div><h2>${escapeHtml(doc.title)}</h2><p style="font-size:24px;color:#555">${escapeHtml((doc.slots as PitchDeckSlots).slides[0]?.title ?? "")}</p></section>
${slides}
${finSlide}
</body></html>`;
}

/** Render a business document to a self-contained, sanitized HTML string. */
export function renderDocumentHtml(doc: BusinessDocument): string {
  return doc.type === "proposal" ? renderProposal(doc) : renderDeck(doc);
}
