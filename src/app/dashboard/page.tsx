import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/ui/app-header";
import { NewProjectForm } from "@/ui/new-project-form";
import { app } from "@/server/runtime";
import { getServerUserId } from "@/server/api-helpers";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  researching: "Riset",
  planning: "Perencanaan",
  branding: "Brand",
  documenting: "Dokumen",
  complete: "Selesai",
};

const MODULES = [
  { key: "1", title: "Validasi Ide", desc: "Riset pasar tergrounding + skor kelayakan.", href: "/research" },
  { key: "2", title: "Business Planner", desc: "Model finansial deterministik & narasi plan.", href: "/calculator" },
  { key: "3", title: "Brand Forge", desc: "Identitas brand: naming, palet, moodboard.", href: "/brand" },
  { key: "4", title: "Deck & Docs", desc: "Proposal & pitch deck PDF investor-grade.", href: "/docs" },
];

export default async function DashboardPage() {
  const userId = await getServerUserId();
  const projects = userId !== null ? await app.projects.listForUser(userId) : [];

  return (
    <div className="min-h-dvh">
      <AppHeader active="beranda" />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl sm:text-3xl">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mulai project baru dari sebuah ide, lalu lewati alur: Validasi → Plan → Brand → Dokumen.
        </p>

        {/* New project */}
        <section className="mt-6 rounded-card border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Project baru</h2>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Tautkan API key di <Link href="/onboarding" className="text-primary hover:underline">Onboarding</Link> agar
            validasi &amp; plan AI aktif. Tanpa key pun kamu bisa pakai Kalkulator.
          </p>
          <NewProjectForm />
        </section>

        {/* Projects */}
        {projects.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold">Project kamu ({projects.length})</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="rounded-card border border-border bg-surface p-4 transition-shadow hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-semibold">{p.title}</h3>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.ideaText}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Journey / modules */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Alur terpandu</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <Link
                key={m.key}
                href={m.href}
                className="rounded-card border border-border bg-surface p-5 transition-shadow hover:shadow-lg hover:shadow-primary/10"
              >
                <span className="font-display text-xl text-border">{m.key}</span>
                <h3 className="mt-1 text-sm font-semibold">{m.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
