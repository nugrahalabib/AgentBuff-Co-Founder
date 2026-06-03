import Link from "next/link";
import { CredentialStatusChip } from "@/ui/credential-status-chip";

type Tab = "beranda" | "kalkulator" | "pengaturan";

/** Authenticated app top bar (PRD §14.3) with a live BYOK credential-status chip.
 *  Kept free of server-only imports so it works in both server and client pages. */
export function AppHeader({ active }: { active?: Tab }) {
  const link = (href: string, label: string, key: Tab) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active === key ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5 10.1 10.9 4.5 9l5.6-1.4L12 2z" />
            </svg>
          </div>
          <span className="font-display text-base">AgentBuff</span>
        </Link>
        <nav className="flex items-center gap-1">
          {link("/dashboard", "Beranda", "beranda")}
          {link("/calculator", "Kalkulator", "kalkulator")}
          {link("/pengaturan", "Pengaturan", "pengaturan")}
          <CredentialStatusChip />
        </nav>
      </div>
    </header>
  );
}
