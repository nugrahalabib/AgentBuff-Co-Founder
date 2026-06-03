import Link from "next/link";

/** Authenticated app top bar (PRD §14.3). Key/quota status is a placeholder until BYOK is wired. */
export function AppHeader({ active }: { active?: "beranda" | "kalkulator" }) {
  const link = (href: string, label: string, key: string) => (
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
          <span className="ml-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground" title="Status kredensial AI">
            BYOK belum ditautkan
          </span>
        </nav>
      </div>
    </header>
  );
}
