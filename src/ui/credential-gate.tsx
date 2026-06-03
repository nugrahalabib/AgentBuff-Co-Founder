"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Inline banner shown on AI-dependent surfaces when the user has no active BYOK credential.
 * Renders nothing while loading or once a key is active, so it never nags unnecessarily. PRD §9.1.4.
 */
export function CredentialGate({ feature = "fitur AI" }: { feature?: string }) {
  const [hasActive, setHasActive] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/byok/status")
      .then((r) => (r.ok ? (r.json() as Promise<{ hasActive: boolean }>) : null))
      .then((d) => {
        if (alive && d !== null) setHasActive(d.hasActive);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (hasActive === null || hasActive) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-300/40 bg-amber-100/50 p-4 text-sm dark:border-amber-400/20 dark:bg-amber-400/10">
      <p className="text-amber-800 dark:text-amber-200">
        <strong>Tautkan API key dulu</strong> untuk mengaktifkan {feature}. Gratis — pakai kuota key milikmu sendiri,
        disimpan terenkripsi.
      </p>
      <Link
        href="/pengaturan"
        className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Buka Pengaturan →
      </Link>
    </div>
  );
}
