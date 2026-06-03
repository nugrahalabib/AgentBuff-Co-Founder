"use client";

import { useState } from "react";
import { Button } from "@/ui/button";

interface ClientView {
  id: string;
  name: string;
  tokenPrefix: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt?: string;
}

const fmt = (iso?: string) => (iso === undefined ? "—" : new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }));

export function McpTokens({ initialClients }: { initialClients: ClientView[] }) {
  const [clients, setClients] = useState<ClientView[]>(initialClients);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    setFreshToken(null);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name }),
      });
      const data = (await res.json()) as { token?: string; clients?: ClientView[]; error?: string };
      if (!res.ok || data.token === undefined) {
        setError(data.error ?? "Gagal membuat token.");
        return;
      }
      setFreshToken(data.token);
      setName("");
      if (data.clients !== undefined) setClients(data.clients);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Cabut token ini? Agen/klien yang memakainya akan langsung kehilangan akses.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", id }),
      });
      const data = (await res.json()) as { clients?: ClientView[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Gagal mencabut token.");
        return;
      }
      if (data.clients !== undefined) setClients(data.clients);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (freshToken === null) return;
    void navigator.clipboard?.writeText(freshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const active = clients.filter((c) => c.status === "active");

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Agent Gateway (MCP)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Buat token untuk menghubungkan agen AI (Claude, dll.) ke AgentBuff lewat protokol MCP. Setiap tool berjalan
        sebagai akunmu dengan kuota & data milikmu. Token disimpan sebagai hash — disalin sekali, tak bisa dilihat lagi.
      </p>

      {error !== "" && (
        <p className="mt-3 rounded-card border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}

      {/* Freshly-created token (shown once) */}
      {freshToken !== null && (
        <div className="mt-4 rounded-card border border-emerald-300/40 bg-emerald-50/60 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Token baru — salin sekarang, tidak ditampilkan lagi:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-surface px-3 py-2 text-xs">{freshToken}</code>
            <button
              onClick={copy}
              className="shrink-0 cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              {copied ? "Tersalin ✓" : "Salin"}
            </button>
          </div>
        </div>
      )}

      {/* Create */}
      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama token (mis. Claude Desktop)"
          className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        <Button onClick={() => void create()} disabled={busy} size="md">
          {busy ? "…" : "Buat token"}
        </Button>
      </div>

      {/* List */}
      {active.length > 0 && (
        <ul className="mt-4 space-y-2">
          {active.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-muted/30 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{c.tokenPrefix}</code> · dibuat {fmt(c.createdAt)} · dipakai {fmt(c.lastUsedAt)}
                </p>
              </div>
              <button
                onClick={() => void revoke(c.id)}
                disabled={busy}
                className="cursor-pointer rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5 disabled:opacity-50"
              >
                Cabut
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Connection hint */}
      <div className="mt-4 rounded-card border border-dashed border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">Cara hubungkan (Streamable HTTP)</p>
        <pre className="mt-1.5 overflow-x-auto text-[11px] leading-relaxed text-muted-foreground">
{`Endpoint : POST /api/mcp
Header   : Authorization: Bearer <token>
Protokol : JSON-RPC 2.0 (initialize, tools/list, tools/call)`}
        </pre>
      </div>
    </div>
  );
}
