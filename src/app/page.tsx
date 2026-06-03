import type { ReactNode } from "react";
import { LinkButton } from "@/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-20">
      <SiteHeader />

      {/* Hero */}
      <section className="pt-10 sm:pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkle className="h-3.5 w-3.5 text-primary" />
          Bagian dari suite AgentBuff · MCP-native
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">
          Co-Founder AI untuk membangun bisnismu dari nol.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Dari &ldquo;punya ide tapi bingung mulai dari mana&rdquo; menjadi <strong>business plan</strong>, identitas{" "}
          <strong>brand</strong>, proposal, dan <strong>pitch deck</strong> siap-investor — dalam hitungan jam.
          Gratis, pakai API key-mu sendiri.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <LinkButton href="/onboarding" size="lg">
            <GoogleMark className="h-5 w-5" />
            Mulai Gratis dengan Google
          </LinkButton>
          <LinkButton href="#cara-kerja" variant="secondary" size="lg">
            Lihat cara kerjanya
          </LinkButton>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          API key-mu dienkripsi & tidak pernah kami lihat dalam bentuk asli.
        </p>
      </section>

      {/* Trust strip */}
      <section className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Angka deterministik", "HPP, BEP, ROI dihitung kode — bukan dikarang AI."],
          ["Sumber bisa diklik", "Tiap klaim pasar punya tautan sumber asli."],
          ["100% Bahasa Indonesia", "Hangat, tanpa jargon, dengan glosarium."],
          ["Mobile-first PWA", "Dipasang di HP tanpa app store."],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-card border border-border bg-surface p-4">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="mt-20 scroll-mt-20">
        <SectionHeading eyebrow="Jalur terpandu" title="Empat langkah, satu alur yang jelas" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            step="1"
            icon={<Search className="h-5 w-5" />}
            title="Validasi Ide"
            desc="Riset pasar tergrounding + skor kelayakan 0–100, lengkap dengan sumber."
          />
          <FeatureCard
            step="2"
            icon={<Chart className="h-5 w-5" />}
            title="Business Planner"
            desc="Model finansial akurat: HPP, margin, BEP, proyeksi, payback — deterministik."
          />
          <FeatureCard
            step="3"
            icon={<Palette className="h-5 w-5" />}
            title="Brand Forge"
            desc="Positioning, naming, palet & tipografi, moodboard, dan konsep logo."
          />
          <FeatureCard
            step="4"
            icon={<Doc className="h-5 w-5" />}
            title="Deck & Docs"
            desc="Proposal PDF & pitch deck investor-grade dari semua datamu."
          />
        </div>
      </section>

      {/* BYOK explainer */}
      <section className="mt-20 rounded-card border border-border bg-surface p-7 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Kenapa gratis?" title="Bring Your Own Key (BYOK)" align="left" />
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">
              Kamu memakai API key milikmu sendiri (Gemini, OpenAI, atau Codex). Biaya AI ditanggung kuotamu —
              untuk Gemini, free tier Google sangat dermawan sehingga sebagian besar pengguna tak pernah membayar.
              AgentBuff Co-Founder hanya menanggung orkestrasi & rendering.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" /> Panduan 60 detik membuat key</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" /> Validasi real-time + deteksi kapabilitas</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-accent" /> Enkripsi envelope, tak pernah di-log</li>
            </ul>
          </div>
          <div className="rounded-card bg-gradient-to-br from-primary to-secondary p-6 text-on-primary">
            <p className="font-display text-2xl">&ldquo;Aku punya ide, tapi takut salah hitung & gagal.&rdquo;</p>
            <p className="mt-3 text-sm opacity-90">
              AgentBuff Co-Founder menjawabnya dengan bukti, angka yang jujur, dan dokumen yang membuatmu terlihat
              kredibel di mata pemberi modal.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-20 text-center">
        <h2 className="font-display text-3xl sm:text-4xl">Siap memulai akhir pekan ini?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Mulai dari ide pertamamu. Tanpa kartu kredit, tanpa biaya tersembunyi.
        </p>
        <div className="mt-7 flex justify-center">
          <LinkButton href="/onboarding" size="lg">
            <GoogleMark className="h-5 w-5" />
            Mulai Gratis dengan Google
          </LinkButton>
        </div>
      </section>

      <footer className="mt-20 border-t border-border pt-8 text-center text-xs text-muted-foreground">
        <p>AgentBuff Co-Founder — bagian dari suite AgentBuff. Output finansial adalah estimasi, bukan jaminan.</p>
      </footer>
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
          <Sparkle className="h-5 w-5" />
        </div>
        <span className="font-display text-lg">AgentBuff</span>
      </div>
      <LinkButton href="/onboarding" variant="ghost" size="md">
        Masuk
      </LinkButton>
    </header>
  );
}

function SectionHeading({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl sm:text-3xl">{title}</h2>
    </div>
  );
}

function FeatureCard({ step, icon, title, desc }: { step: string; icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">{icon}</div>
        <span className="font-display text-2xl text-border">{step}</span>
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

/* --- Inline SVG icons (no emoji as icons; PRD §14, ui-ux-pro-max). --- */
type IconProps = { className?: string };
const Sparkle = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5 10.1 10.9 4.5 9l5.6-1.4L12 2z" />
  </svg>
);
const Lock = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 1 1 8 0v4" />
  </svg>
);
const Check = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const Search = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);
const Chart = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
  </svg>
);
const Palette = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="8.5" cy="9.5" r="1" fill="currentColor" />
    <circle cx="15.5" cy="9.5" r="1" fill="currentColor" />
    <circle cx="9.5" cy="15" r="1" fill="currentColor" />
  </svg>
);
const Doc = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h6" />
  </svg>
);
const GoogleMark = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden>
    <path fill="#FFC107" d="M21.35 11.1H12v3.83h5.34A5.34 5.34 0 0 1 6.66 12 5.34 5.34 0 0 1 12 6.66c1.36 0 2.6.51 3.54 1.36l2.7-2.7A9 9 0 1 0 21 12c0-.61-.06-1.2-.16-1.76z" />
    <path fill="#FF3D00" d="M3.15 7.35l3.15 2.31A5.34 5.34 0 0 1 12 6.66c1.36 0 2.6.51 3.54 1.36l2.7-2.7A9 9 0 0 0 3.15 7.35z" />
    <path fill="#4CAF50" d="M12 21a9 9 0 0 0 6.07-2.35l-2.8-2.37A5.34 5.34 0 0 1 6.7 14.3l-3.13 2.4A9 9 0 0 0 12 21z" />
    <path fill="#1976D2" d="M21.35 11.1H12v3.83h5.34a5.36 5.36 0 0 1-1.87 2.35l2.8 2.37C20.4 18 21 15.4 21 12c0-.31-.02-.6-.05-.9z" />
  </svg>
);
