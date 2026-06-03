"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/button";

export function NewProjectForm() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok || data.project === undefined) {
        setError(data.error ?? "Gagal membuat project.");
        return;
      }
      router.push(`/project/${data.project.id}`);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={2}
        placeholder="Ceritakan ide bisnismu dalam 1–3 kalimat… (mis. kedai kopi spesialti untuk pekerja kantoran di Jakarta)"
        className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={create} disabled={idea.trim() === "" || loading}>
          {loading ? "Membuat…" : "Buat Project"}
        </Button>
        {error !== "" && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
