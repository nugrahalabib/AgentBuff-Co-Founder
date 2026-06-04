import type { Metadata } from "next";
import Link from "next/link";
import { app } from "@/server/runtime";
import { getServerSession, getServerUserId } from "@/server/api-helpers";
import { AppHeader } from "@/ui/app-header";
import { GoogleSignInButton, SignOutButton } from "@/ui/google-auth";
import { KeyManager } from "./key-manager";
import { McpTokens } from "./mcp-tokens";
import { DataRights } from "./data-rights";

export const metadata: Metadata = { title: "Pengaturan" };

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await getServerSession();
  const user = session?.user;
  const userId = await getServerUserId();

  if (user === undefined || user === null) {
    return (
      <main className="mx-auto max-w-lg px-5 py-10">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Kembali
        </Link>
        <div className="mt-10 rounded-card border border-border bg-surface p-7 text-center">
          <h1 className="font-display text-2xl">Masuk dulu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pengaturan kunci API & akun butuh kamu masuk dengan Google.
          </p>
          <div className="mt-6">
            <GoogleSignInButton callbackUrl="/pengaturan" label="Masuk dengan Google" variant="primary" />
          </div>
        </div>
      </main>
    );
  }

  const summary = userId !== null ? await app.credentialService.summary(userId) : null;
  const mcpClients = userId !== null ? await app.mcpGateway.listClients(userId) : [];
  const usage = userId !== null ? await app.usage.summary(userId) : null;

  const OP_LABEL: Record<string, string> = {
    structured: "Generasi terstruktur",
    grounded: "Riset tergrounding",
    image: "Generasi gambar",
    deep_research: "Deep Research",
  };

  return (
    <div className="min-h-dvh">
      <AppHeader active="pengaturan" />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-2xl sm:text-3xl">Pengaturan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kelola kunci API (BYOK) dan akunmu. Kunci disimpan terenkripsi — kami tak pernah melihat versi aslinya.
        </p>

        {/* Account */}
        <section className="mt-6 rounded-card border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Akun</h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name ?? "Pengguna"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email ?? "—"}</p>
            </div>
            <SignOutButton />
          </div>
        </section>

        {/* BYOK key management */}
        <section className="mt-6">
          <KeyManager initialSummary={summary} />
        </section>

        {/* BYOK usage */}
        {usage !== null && usage.total > 0 && (
          <section className="mt-6 rounded-card border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Pemakaian AI (kuota key-mu)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Setiap panggilan AI memakai kuota key milikmu. Ini ringkasannya — agar kamu sadar konsumsi.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <UsageStat label="Total panggilan" value={usage.total} />
              <UsageStat label="Kueri tergrounding" value={usage.groundedQueries} />
              <UsageStat label="Gambar dibuat" value={usage.imagesGenerated} />
              <UsageStat label="Provider" value={Object.keys(usage.byProvider).filter((p) => p !== "unknown").length} />
            </div>
            {Object.keys(usage.byOperation).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {Object.entries(usage.byOperation).map(([op, n]) => (
                  <li key={op} className="flex justify-between">
                    <span>{OP_LABEL[op] ?? op}</span>
                    <span className="tabular-nums">{n}×</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* MCP Agent Gateway tokens */}
        <section className="mt-6">
          <McpTokens initialClients={mcpClients} />
        </section>

        {/* Data & privacy (UU PDP) */}
        <section className="mt-6">
          <DataRights />
        </section>
      </main>
    </div>
  );
}
