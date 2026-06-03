// src/ui/cash-flow-chart.tsx — dependency-free SVG chart of cumulative cash + monthly net profit. PRD §9.3.9.
// Plots the deterministic engine output only (no smoothing/estimation). Highlights the zero line so a
// dip below zero (cash runs out) is obvious.

interface Point {
  month: number;
  cumulativeCash: number;
  netProfit: number;
}

export function CashFlowChart({ projections }: { projections: Point[] }) {
  if (projections.length === 0) {
    return <p className="text-xs text-muted-foreground">Belum ada proyeksi.</p>;
  }

  const W = 320;
  const H = 120;
  const PAD = 6;
  const months = projections.map((p) => p.month);
  const minMonth = Math.min(...months);
  const maxMonth = Math.max(...months);
  const values = projections.flatMap((p) => [p.cumulativeCash, p.netProfit]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;

  const x = (m: number) => PAD + ((m - minMonth) / Math.max(1, maxMonth - minMonth)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);

  const line = (sel: (p: Point) => number) => projections.map((p) => `${x(p.month)},${y(sel(p))}`).join(" ");
  const zeroY = y(0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Grafik proyeksi kas dan laba">
        {/* zero baseline */}
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="currentColor" strokeWidth="0.5" className="text-border" />
        {/* net profit (thin) */}
        <polyline points={line((p) => p.netProfit)} fill="none" stroke="currentColor" strokeWidth="1.25" className="text-warning/70" />
        {/* cumulative cash (bold) */}
        <polyline points={line((p) => p.cumulativeCash)} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-primary" /> Kas kumulatif
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-warning/70" /> Laba bersih / bulan
        </span>
      </div>
    </div>
  );
}
