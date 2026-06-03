import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { GoogleSignInButton } from "@/ui/google-auth";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Kembali
      </Link>

      {user ? (
        <div className="mt-6">
          <OnboardingWizard initialName={user.name ?? ""} />
        </div>
      ) : (
        <div className="mt-10 rounded-card border border-border bg-surface p-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5 10.1 10.9 4.5 9l5.6-1.4L12 2z" />
            </svg>
          </div>
          <h1 className="mt-4 font-display text-2xl">Daftar / Masuk dulu</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Buat akun gratis dengan Google untuk memulai. Setelah itu kamu isi profil singkat & ide bisnismu, lalu (opsional)
            tautkan API key.
          </p>
          <div className="mt-6">
            <GoogleSignInButton callbackUrl="/onboarding" label="Daftar Gratis dengan Google" variant="primary" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Gratis selamanya · pakai kuota API key-mu sendiri (BYOK).</p>
        </div>
      )}
    </main>
  );
}
