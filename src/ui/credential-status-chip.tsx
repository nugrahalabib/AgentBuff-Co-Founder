"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProviderId = "gemini" | "openai" | "openai_codex";
interface StatusShape {
  hasActive: boolean;
  defaultProvider: ProviderId | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  openai_codex: "Codex",
};

/** Live BYOK status pill in the header. Fetches client-side so it works in both server & client pages. */
export function CredentialStatusChip() {
  const [status, setStatus] = useState<StatusShape | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/byok/status")
      .then((r) => (r.ok ? (r.json() as Promise<StatusShape>) : null))
      .then((d) => {
        if (alive && d !== null) setStatus(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (status === null) {
    return <span className="ml-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">BYOK…</span>;
  }

  if (!status.hasActive) {
    return (
      <Link
        href="/pengaturan"
        title="Status kredensial AI"
        className="ml-2 rounded-full border border-amber-300/40 bg-amber-100/60 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"
      >
        ⚠ BYOK belum aktif
      </Link>
    );
  }

  const label = status.defaultProvider !== null ? (PROVIDER_LABEL[status.defaultProvider] ?? "AI") : "AI";
  return (
    <Link
      href="/pengaturan"
      title="Status kredensial AI"
      className="ml-2 flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-100/60 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {label} aktif
    </Link>
  );
}
