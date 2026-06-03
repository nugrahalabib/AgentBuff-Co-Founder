// src/server/services/usage-recorder.ts — BYOK usage/cost awareness. PRD §16, §12.4.
// Records every LLM operation (which runs on the user's own key/quota) so the UI can surface
// transparent consumption. In-memory for dev/tests; Prisma-backed in production. No secrets stored.

import type { ProviderId } from "@/lib/ai/types";

export type UsageOperation = "structured" | "grounded" | "image" | "deep_research";

export interface UsageEntry {
  userId: string;
  operation: UsageOperation;
  provider: ProviderId;
  model?: string;
  groundedQueries?: number;
  imagesGenerated?: number;
  source?: "ui" | "mcp";
  ts: string;
}

export interface UsageSummary {
  total: number;
  byOperation: Record<string, number>;
  byProvider: Record<string, number>;
  groundedQueries: number;
  imagesGenerated: number;
  recent: UsageEntry[];
}

export interface UsageRecorder {
  record(entry: UsageEntry): Promise<void>;
  summary(userId: string, limit?: number): Promise<UsageSummary>;
}

export function emptySummary(): UsageSummary {
  return { total: 0, byOperation: {}, byProvider: {}, groundedQueries: 0, imagesGenerated: 0, recent: [] };
}

/** Fold a list of entries into a summary (shared by both store impls). */
export function summarize(entries: UsageEntry[], limit = 20): UsageSummary {
  const s = emptySummary();
  for (const e of entries) {
    s.total += 1;
    s.byOperation[e.operation] = (s.byOperation[e.operation] ?? 0) + 1;
    s.byProvider[e.provider] = (s.byProvider[e.provider] ?? 0) + 1;
    s.groundedQueries += e.groundedQueries ?? 0;
    s.imagesGenerated += e.imagesGenerated ?? 0;
  }
  s.recent = entries.slice(-limit).reverse();
  return s;
}

export class InMemoryUsageRecorder implements UsageRecorder {
  private readonly entries: UsageEntry[] = [];
  async record(entry: UsageEntry): Promise<void> {
    this.entries.push(entry);
  }
  async summary(userId: string, limit = 20): Promise<UsageSummary> {
    return summarize(
      this.entries.filter((e) => e.userId === userId),
      limit,
    );
  }
  /** Remove all of a user's usage records (account erasure, §13.4). */
  clearUser(userId: string): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i]!.userId === userId) this.entries.splice(i, 1);
    }
  }
}
