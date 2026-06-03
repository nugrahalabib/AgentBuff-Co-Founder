import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { app } from "@/server/runtime";
import { getServerUserId } from "@/server/api-helpers";
import { AppHeader } from "@/ui/app-header";
import { GoogleSignInButton, SignOutButton } from "@/ui/google-auth";
import { KeyManager } from "./key-manager";
import { McpTokens } from "./mcp-tokens";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const session = await auth();
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

        {/* MCP Agent Gateway tokens */}
        <section className="mt-6">
          <McpTokens initialClients={mcpClients} />
        </section>
      </main>
    </div>
  );
}
