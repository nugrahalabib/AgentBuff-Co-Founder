"use client";

// "Login dengan ChatGPT (Codex)" — drives the loopback OAuth flow: start → open OpenAI consent in a new
// tab → poll until the local listener catches the callback and the server stores the (encrypted) session.
// HONEST: this only works when AgentBuff runs on the same machine as your browser (local / self-host).

import { useEffect, useRef, useState } from "react";
import { Button } from "@/ui/button";

type Phase = "idle" | "starting" | "waiting" | "success" | "error";

export function CodexLoginButton({ onLinked }: { onLinked?: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    return () => {
      stopped.current = true;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  function scheduleNext(loginId: string, tries: number) {
    if (stopped.current) return;
    timer.current = setTimeout(() => void poll(loginId, tries + 1), 2000);
  }

  async function poll(loginId: string, tries: number) {
    if (stopped.current) return;
    try {
      const res = await fetch("/api/byok/codex/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      });
      const data = (await res.json()) as {
        status?: string;
        error?: string;
        email?: string | null;
        plan?: string | null;
      };
      if (data.status === "success") {
        setPhase("success");
        const who = data.email !== null && data.email !== undefined ? data.email : "akun ChatGPT-mu";
        const plan = data.plan !== null && data.plan !== undefined && data.plan !== "" ? ` · ${data.plan}` : "";
        setMsg(`Terhubung sebagai ${who}${plan} ✓`);
        onLinked?.();
        return;
      }
      if (data.status === "error") {
        setPhase("error");
        setMsg(data.error ?? "Login ChatGPT gagal. Coba lagi.");
        return;
      }
    } catch {
      /* network blip — keep polling */
    }
    if (tries >= 150) {
      setPhase("error");
      setMsg("Waktu login habis (5 menit). Coba lagi.");
      return;
    }
    scheduleNext(loginId, tries);
  }

  async function start() {
    setPhase("starting");
    setMsg("");
    stopped.current = false;
    try {
      const res = await fetch("/api/byok/codex/start", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; loginId?: string; authorizeUrl?: string; error?: string; hint?: string };
      if (!res.ok || data.ok !== true || data.authorizeUrl === undefined || data.loginId === undefined) {
        setPhase("error");
        setMsg([data.error, data.hint].filter((s) => s !== undefined && s !== "").join(" "));
        return;
      }
      window.open(data.authorizeUrl, "_blank", "noopener,noreferrer");
      setPhase("waiting");
      setMsg("Menunggu kamu menyetujui di tab ChatGPT…");
      scheduleNext(data.loginId, 0);
    } catch {
      setPhase("error");
      setMsg("Tidak bisa menghubungi server.");
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Login dengan ChatGPT (Codex)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pakai langganan ChatGPT-mu sebagai mesin AI — tanpa API key Gemini/OpenAI.
          </p>
        </div>
        <Button
          onClick={() => void start()}
          disabled={phase === "starting" || phase === "waiting"}
          variant="secondary"
          size="md"
        >
          {phase === "starting" ? "Membuka…" : phase === "waiting" ? "Menunggu…" : phase === "success" ? "Tersambung ✓" : "Login ChatGPT"}
        </Button>
      </div>

      {msg !== "" && (
        <p className={`mt-2 text-xs ${phase === "success" ? "text-accent" : phase === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {msg}
        </p>
      )}

      <p className="mt-3 rounded-lg border border-amber-300/40 bg-amber-100/40 p-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
        ⚠️ <b>Risiko ditanggung sendiri.</b> Ini memakai <b>akun ChatGPT-mu sendiri</b> — sesi langgananmu yang
        dipakai jadi mesin AI, bukan akun orang lain. Memakai sesi ChatGPT untuk otomatisasi berada di area abu-abu
        ketentuan OpenAI, jadi <b>akunmu sendiri</b> berpotensi kena pembatasan/blokir oleh OpenAI — keputusan ada di
        tanganmu. Kalau ragu, pakai API key Gemini/OpenAI saja. Login ini juga hanya berfungsi saat AgentBuff jalan di
        komputermu sendiri (mode lokal/self-host; callback ke <code>localhost:1455</code>). Sesi disimpan terenkripsi
        &amp; tak pernah ditampilkan.
      </p>
    </div>
  );
}
