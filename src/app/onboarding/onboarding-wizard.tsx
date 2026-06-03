"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/button";

const SECTORS = ["F&B", "Fashion / Thrift", "Jasa", "Kreatif", "Ritel", "Digital", "Lainnya"];
const STAGES: [string, string][] = [
  ["idea", "Masih ide"],
  ["running", "Sudah jalan"],
];
const GOALS: [string, string][] = [
  ["validate", "Validasi ide"],
  ["funding", "Cari modal"],
  ["scale", "Naik kelas"],
];
const BUDGETS = ["< Rp5 jt", "Rp5–25 jt", "Rp25–100 jt", "> Rp100 jt"];

const PROVIDERS = [
  { id: "gemini", label: "Gemini API key", hint: "Free tier Google — disarankan", url: "https://aistudio.google.com/apikey", ph: "AIza…" },
  { id: "openai", label: "OpenAI API key", hint: "Usage-based (Responses API)", url: "https://platform.openai.com/api-keys", ph: "sk-…" },
  { id: "openai_codex", label: "Codex (ChatGPT)", hint: "Token dari `codex login`", url: "https://developers.openai.com/codex/", ph: "access token" },
] as const;

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — profile
  const [displayName, setDisplayName] = useState(initialName);
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");

  // Step 2 — idea
  const [idea, setIdea] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);

  // Step 3 — BYOK
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]["id"]>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "validating" | "valid" | "error">("idle");
  const [keyMsg, setKeyMsg] = useState("");

  async function saveProfile() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, sector, stage, primaryGoal: goal, budgetBand: budget }),
      });
      if (!res.ok) {
        setError("Gagal menyimpan profil.");
        return;
      }
      setStep(2);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, sector }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok || data.project === undefined) {
        setError(data.error ?? "Gagal membuat project.");
        return;
      }
      setProjectId(data.project.id);
      setStep(3);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  async function linkKey() {
    setKeyStatus("validating");
    setKeyMsg("");
    try {
      const res = await fetch("/api/byok/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setKeyStatus("valid");
        setKeyMsg("Kredensial valid ✓");
      } else {
        setKeyStatus("error");
        setKeyMsg(data.error ?? "Kredensial ditolak.");
      }
    } catch {
      setKeyStatus("error");
      setKeyMsg("Tidak bisa menghubungi server validasi.");
    }
  }

  const finish = () => router.push(projectId !== null ? `/project/${projectId}` : "/dashboard");
  const activeProvider = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div>
      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      {error !== "" && (
        <p className="mb-4 rounded-card border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}

      {/* STEP 1 — Profile */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-display text-2xl">Kenalan dulu yuk 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">Beberapa info singkat supaya AgentBuff bisa menyesuaikan untukmu.</p>
          </div>

          <Field label="Nama panggilan">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="mis. Sari"
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </Field>

          <Field label="Sektor bisnis">
            <ChipGroup options={SECTORS.map((s) => [s, s])} value={sector} onChange={setSector} />
          </Field>
          <Field label="Tahap">
            <ChipGroup options={STAGES} value={stage} onChange={setStage} />
          </Field>
          <Field label="Tujuan utama">
            <ChipGroup options={GOALS} value={goal} onChange={setGoal} />
          </Field>
          <Field label="Skala anggaran (opsional)">
            <ChipGroup options={BUDGETS.map((b) => [b, b])} value={budget} onChange={setBudget} />
          </Field>

          <Button onClick={saveProfile} disabled={busy || sector === "" || stage === "" || goal === ""} size="lg" className="w-full">
            {busy ? "Menyimpan…" : "Lanjut"}
          </Button>
        </div>
      )}

      {/* STEP 2 — Idea */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-display text-2xl">Ceritakan ide bisnismu</h1>
            <p className="mt-1 text-sm text-muted-foreground">1–3 kalimat saja. Ini jadi project pertamamu.</p>
          </div>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            placeholder="mis. Kedai kopi spesialti untuk pekerja kantoran di Jakarta, fokus biji lokal."
            className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex gap-2">
            <Button onClick={() => setStep(1)} variant="secondary" size="lg">
              Kembali
            </Button>
            <Button onClick={createProject} disabled={busy || idea.trim() === ""} size="lg" className="flex-1">
              {busy ? "Membuat…" : "Lanjut"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — BYOK */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h1 className="font-display text-2xl">Tautkan API key (BYOK)</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gratis — biaya AI memakai kuota key milikmu. Dienkripsi, tak pernah kami lihat asli. Bisa juga dilewati dan diisi nanti.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProvider(p.id);
                  setKeyStatus("idle");
                  setKeyMsg("");
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

          <a href={activeProvider.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-primary hover:underline">
            Cara dapat {provider === "openai_codex" ? "token" : "key"} ↗
          </a>

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={activeProvider.ph}
              autoComplete="off"
              className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <Button onClick={linkKey} disabled={apiKey.trim() === "" || keyStatus === "validating"} size="md">
              {keyStatus === "validating" ? "Cek…" : "Validasi"}
            </Button>
          </div>
          {keyMsg !== "" && (
            <p className={`text-sm ${keyStatus === "valid" ? "text-accent" : "text-destructive"}`}>{keyMsg}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={finish} variant="secondary" size="lg">
              Lewati dulu
            </Button>
            <Button onClick={finish} disabled={keyStatus !== "valid"} variant="accent" size="lg" className="flex-1">
              Selesai → Buka Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function ChipGroup({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([val, lbl]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === val ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:bg-muted"
          }`}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}
