"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/ui/button";

type Provider = "gemini" | "openai";
type Status = "idle" | "validating" | "valid" | "error";

const GUIDE: Record<Provider, { label: string; hint: string; url: string }> = {
  gemini: {
    label: "Gemini API key",
    hint: "Paling ramah pemula — free tier Google dermawan. Disarankan.",
    url: "https://aistudio.google.com/apikey",
  },
  openai: {
    label: "OpenAI API key",
    hint: "Usage-based via OpenAI Platform (Responses API).",
    url: "https://platform.openai.com/api-keys",
  },
};

export default function OnboardingPage() {
  const [provider, setProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [caps, setCaps] = useState<string[]>([]);

  async function validate() {
    setStatus("validating");
    setMessage("");
    setCaps([]);
    try {
      const res = await fetch("/api/byok/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        detail?: string;
        error?: string;
        capabilities?: Record<string, boolean>;
      };
      if (data.ok) {
        setStatus("valid");
        setMessage("Kredensial valid ✓ — kamu siap memakai fitur AI.");
        setCaps(Object.entries(data.capabilities ?? {}).filter(([, v]) => v).map(([k]) => k));
      } else {
        setStatus("error");
        setMessage(data.error ?? data.detail ?? "Kredensial ditolak. Periksa kembali key-mu.");
      }
    } catch {
      setStatus("error");
      setMessage("Tidak bisa menghubungi server validasi. Coba lagi.");
    }
  }

  const guide = GUIDE[provider];

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Kembali
      </Link>

      <div className="mt-6 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n === 1 ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      <h1 className="mt-6 font-display text-2xl">Tautkan API key-mu</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        AgentBuff Co-Founder gratis — biaya AI memakai kuota key milikmu (BYOK). Key-mu dienkripsi dan tak pernah kami
        lihat dalam bentuk asli.
      </p>

      {/* Provider selector */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {(Object.keys(GUIDE) as Provider[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setProvider(p);
              setStatus("idle");
              setMessage("");
            }}
            className={`cursor-pointer rounded-card border p-3 text-left text-sm transition-colors ${
              provider === p ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-muted"
            }`}
          >
            <span className="font-semibold">{GUIDE[p].label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{GUIDE[p].hint}</span>
          </button>
        ))}
      </div>

      <a
        href={guide.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        Buka halaman {provider === "gemini" ? "Google AI Studio" : "OpenAI"} untuk membuat key ↗
      </a>

      {/* Paste field */}
      <div className="mt-4">
        <label className="text-sm font-medium" htmlFor="apikey">
          Tempel API key
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="apikey"
            type={show ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "gemini" ? "AIza…" : "sk-…"}
            autoComplete="off"
            className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="cursor-pointer rounded-xl border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
          >
            {show ? "Sembunyikan" : "Lihat"}
          </button>
        </div>
      </div>

      <Button
        onClick={validate}
        disabled={apiKey.trim() === "" || status === "validating"}
        size="lg"
        className="mt-4 w-full"
      >
        {status === "validating" ? "Memeriksa key…" : "Validasi key"}
      </Button>

      {/* Status */}
      {message !== "" && (
        <div
          className={`mt-4 rounded-card border p-4 text-sm ${
            status === "valid"
              ? "border-accent/30 bg-accent/5 text-accent"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {message}
          {caps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {caps.map((c) => (
                <span key={c} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
        Key hanya dipakai untuk memvalidasi koneksi; tidak disimpan di langkah ini.
      </p>

      {status === "valid" && (
        <Link href="/dashboard" className="mt-6 block">
          <Button variant="accent" size="lg" className="w-full">
            Lanjut ke Dashboard →
          </Button>
        </Link>
      )}
    </main>
  );
}
