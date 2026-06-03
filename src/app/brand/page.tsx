import type { Metadata } from "next";
import { AppHeader } from "@/ui/app-header";

export const metadata: Metadata = { title: "Brand Forge Studio" };

const PALETTE = [
  ["Primary", "#6366F1"],
  ["Secondary", "#818CF8"],
  ["Accent", "#059669"],
  ["Foreground", "#1E1B4B"],
  ["Muted", "#EBEFF9"],
];

const NAMING = ["Tumbuh Kopi", "Sari Roti Rumahan", "Lapak Pilihan", "Rasa Nusantara", "Beranda Brand"];

export default function BrandPage() {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl sm:text-3xl">Brand Forge Studio</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Menempa identitas brand dari business plan yang sudah tervalidasi: positioning, naming, tone, palet &amp;
          tipografi, moodboard, dan konsep logo. Gambar di-generate via Nano Banana / gpt-image dengan API key-mu (BYOK).
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Positioning & Strategi">
            <p className="text-sm text-muted-foreground">
              <em>Brand essence</em>, positioning statement, value pillars, dan persona target — diturunkan otomatis dari
              value proposition di business plan-mu.
            </p>
            <Locked />
          </Card>

          <Card title="Naming Studio">
            <ul className="flex flex-wrap gap-2">
              {NAMING.map((n) => (
                <li key={n} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm">
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Contoh arah penamaan (disclaimer: verifikasi merek ke DJKI).</p>
          </Card>

          <Card title="Palet Warna">
            <div className="flex flex-wrap gap-3">
              {PALETTE.map(([name, hex]) => (
                <div key={name} className="text-center">
                  <div className="h-12 w-12 rounded-xl border border-border" style={{ backgroundColor: hex }} />
                  <p className="mt-1 text-[10px] font-medium">{name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{hex}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Tipografi">
            <p className="font-display text-2xl">Calistoga — Heading</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Inter — body text yang jernih & ramah untuk pemula. Pasangan font open-source (bebas lisensi).
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">JetBrains Mono — angka & data</p>
          </Card>

          <Card title="Moodboard">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <Locked label="Membuat konsep visual… (memakai kuota AI-mu)" />
          </Card>

          <Card title="Konsep Logo">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8M12 8v8" />
                  </svg>
                </div>
              ))}
            </div>
            <Locked />
          </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Locked({ label = "Tautkan API key untuk men-generate" }: { label?: string }) {
  return (
    <a href="/onboarding" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 1 1 8 0v4" />
      </svg>
      {label}
    </a>
  );
}
