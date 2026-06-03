"use client";

import { useState } from "react";
import { Button } from "@/ui/button";

type ProviderId = "gemini" | "openai" | "openai_codex";

interface Capabilities {
  groundedSearch: boolean;
  deepResearch: boolean;
  imageGen: boolean;
  vision: boolean;
  docUnderstanding: boolean;
  docAgentCli: boolean;
}
interface CredentialView {
  provider: ProviderId;
  credType: string;
  fingerprint: string;
  capabilities: Capabilities;
  isDefault: boolean;
  status: "active" | "invalid" | "revoked";
}
interface CredentialSummary {
  hasActive: boolean;
  defaultProvider: ProviderId | null;
  credentials: CredentialView[];
}

const PROVIDERS: { id: ProviderId; label: string; hint: string; url: string; ph: string }[] = [
  { id: "gemini", label: "Gemini API key", hint: "Free tier Google — disarankan", url: "https://aistudio.google.com/apikey", ph: "AIza…" },
  { id: "openai", label: "OpenAI API key", hint: "Usage-based (Responses API)", url: "https://platform.openai.com/api-keys", ph: "sk-…" },
  { id: "openai_codex", label: "Codex (ChatGPT)", hint: "Token dari `codex login`", url: "https://developers.openai.com/codex/", ph: "access token" },
];

const PROVIDER_LABEL: Record<ProviderId, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  openai_codex: "Codex (ChatGPT)",
};

const CAP_LABEL: { key: keyof Capabilities; label: string }[] = [
  { key: "groundedSearch", label: "Riset tergrounding" },
  { key: "deepResearch", label: "Deep Research" },
  { key: "imageGen", label: "Generasi gambar" },
  { key: "vision", label: "Vision/OCR" },
  { key: "docUnderstanding", label: "Baca dokumen" },
];

const STATUS_META: Record<CredentialView["status"], { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "border-emerald-300/40 bg-emerald-100/60 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" },
  invalid: { label: "Tidak valid", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  revoked: { label: "Dicabut", cls: "border-border bg-muted text-muted-foreground" },
};

export function KeyManager({ initialSummary }: { initialSummary: CredentialSummary | null }) {
  const [summary, setSummary] = useState<CredentialSummary>(
    initialSummary ?? { hasActive: false, defaultProvider: null, credentials: [] },
  );
  const [busy, setBusy] = useState<string | null>(null); // action key currently running
  const [error, setError] = useState("");

  // Add / replace form
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [linkStatus, setLinkStatus] = useState<"idle" | "validating" | "valid" | "error">("idle");
  const [linkMsg, setLinkMsg] = useState("");

  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;

  async function refresh() {
    const res = await fetch("/api/byok/status");
    if (res.ok) setSummary((await res.json()) as CredentialSummary);
  }

  async function linkKey() {
    setLinkStatus("validating");
    setLinkMsg("");
    setError("");
    try {
      const res = await fetch("/api/byok/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setLinkStatus("valid");
        setLinkMsg("Kredensial valid & tersimpan ✓");
        setApiKey("");
        await refresh();
      } else {
        setLinkStatus("error");
        setLinkMsg(data.error ?? "Kredensial ditolak.");
      }
    } catch {
      setLinkStatus("error");
      setLinkMsg("Tidak bisa menghubungi server.");
    }
  }

  async function manage(action: "revalidate" | "default" | "remove", target?: ProviderId) {
    const key = `${action}:${target ?? "all"}`;
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/byok/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, provider: target }),
      });
      const data = (await res.json()) as CredentialSummary & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Aksi gagal.");
        return;
      }
      setSummary(data);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  const creds = summary.credentials;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Kunci API (BYOK)</h2>
        {creds.length > 0 && (
          <Button
            onClick={() => void manage("revalidate")}
            variant="secondary"
            size="md"
            disabled={busy !== null}
          >
            {busy === "revalidate:all" ? "Memeriksa…" : "Periksa ulang semua"}
          </Button>
        )}
      </div>

      {error !== "" && (
        <p className="rounded-card border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}

      {/* Credential list */}
      {creds.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Belum ada kunci tertaut. Tambahkan minimal satu agar fitur AI (validasi ide, narasi plan, brand, dokumen) aktif.
        </div>
      ) : (
        <ul className="space-y-3">
          {creds.map((c) => {
            const enabled = CAP_LABEL.filter(({ key }) => c.capabilities[key]);
            const sm = STATUS_META[c.status];
            return (
              <li key={c.provider} className="rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{PROVIDER_LABEL[c.provider]}</span>
                    {c.isDefault && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Utama</span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sm.cls}`}>{sm.label}</span>
                  </div>
                  <code className="text-xs text-muted-foreground" title="Sidik jari kunci (bukan kunci asli)">
                    {c.fingerprint.slice(0, 12)}…
                  </code>
                </div>

                {enabled.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {enabled.map(({ key, label }) => (
                      <span key={key} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!c.isDefault && c.status === "active" && (
                    <button
                      onClick={() => void manage("default", c.provider)}
                      disabled={busy !== null}
                      className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      {busy === `default:${c.provider}` ? "…" : "Jadikan utama"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Hapus kunci ${PROVIDER_LABEL[c.provider]}? Fitur AI yang memakainya akan nonaktif.`)) {
                        void manage("remove", c.provider);
                      }
                    }}
                    disabled={busy !== null}
                    className="cursor-pointer rounded-full border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5 disabled:opacity-50"
                  >
                    {busy === `remove:${c.provider}` ? "Menghapus…" : "Hapus"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add / replace */}
      <div className="rounded-card border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">Tambah / ganti kunci</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setLinkStatus("idle");
                setLinkMsg("");
              }}
              className={`cursor-pointer rounded-card border p-3 text-left text-sm transition-colors ${
                provider === p.id ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-muted"
              }`}
            >
              <span className="font-semibold">{p.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{p.hint}</span>
            </button>
          ))}
        </div>

        <a
          href={activeProvider.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Cara dapat {provider === "openai_codex" ? "token" : "key"} ↗
        </a>

        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={activeProvider.ph}
            autoComplete="off"
            className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <Button onClick={() => void linkKey()} disabled={apiKey.trim() === "" || linkStatus === "validating"} size="md">
            {linkStatus === "validating" ? "Cek…" : "Validasi & simpan"}
          </Button>
        </div>
        {linkMsg !== "" && (
          <p className={`mt-2 text-sm ${linkStatus === "valid" ? "text-accent" : "text-destructive"}`}>{linkMsg}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Kunci dienkripsi (envelope/AES-256-GCM) sebelum disimpan, tidak pernah dicatat di log, dan hanya didekripsi
          sesaat di memori ketika memanggil provider. Biaya AI memakai kuota kunci milikmu sendiri.
        </p>
      </div>
    </div>
  );
}
