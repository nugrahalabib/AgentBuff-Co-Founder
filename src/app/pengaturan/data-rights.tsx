"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function DataRights() {
  const [arming, setArming] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        setError(data.error ?? "Gagal menghapus akun.");
        return;
      }
      // Data is gone; wipe any device cache, then sign out (Google) and return home.
      navigator.serviceWorker?.controller?.postMessage({ type: "clear-cache" });
      void signOut({ callbackUrl: "/" });
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Data &amp; Privasi</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sesuai UU PDP: kamu bisa mengunduh seluruh datamu kapan saja, atau menghapus akun &amp; semua data secara
        permanen.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="/api/account/export"
          className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-muted"
        >
          Unduh data saya (JSON)
        </a>
        {!arming ? (
          <button
            onClick={() => setArming(true)}
            className="cursor-pointer rounded-full border border-destructive/30 px-4 py-1.5 text-sm text-destructive hover:bg-destructive/5"
          >
            Hapus akun…
          </button>
        ) : null}
      </div>

      {arming && (
        <div className="mt-3 rounded-card border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">
            Ini permanen. Semua project, riset, plan, brand, dokumen, kunci, dan token akan dihapus. Ketik{" "}
            <strong>HAPUS</strong> untuk konfirmasi.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="HAPUS"
              className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-destructive"
            />
            <button
              onClick={() => void remove()}
              disabled={busy || confirm !== "HAPUS"}
              className="cursor-pointer rounded-full bg-destructive px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Menghapus…" : "Hapus permanen"}
            </button>
            <button
              onClick={() => {
                setArming(false);
                setConfirm("");
              }}
              className="cursor-pointer rounded-full border border-border px-4 py-1.5 text-sm hover:bg-muted"
            >
              Batal
            </button>
          </div>
          {error !== "" && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
