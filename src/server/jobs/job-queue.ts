// src/server/jobs/job-queue.ts — async job seam. PRD §10.3, §15.1 (async-first; long AI runs as background
// jobs with streamed progress). The in-memory queue runs handlers in-process and tracks status/progress for
// dev/tests; a BullMQ/Redis-backed impl drops in behind the same interface (config-driven via REDIS_URL).

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobProgress {
  stage: string;
  percent?: number;
}

export interface JobRecord<T = unknown> {
  id: string;
  status: JobStatus;
  progress?: JobProgress;
  result?: T;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobHandler<T> = (onProgress: (p: JobProgress) => void) => Promise<T>;

export interface JobQueue {
  enqueue<T>(handler: JobHandler<T>): Promise<{ id: string }>;
  get(id: string): Promise<JobRecord | null>;
}

export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, JobRecord>();

  constructor(
    private readonly idGen: () => string,
    private readonly now: () => string,
  ) {}

  async enqueue<T>(handler: JobHandler<T>): Promise<{ id: string }> {
    const id = this.idGen();
    const rec: JobRecord<T> = { id, status: "queued", createdAt: this.now(), updatedAt: this.now() };
    this.jobs.set(id, rec as JobRecord);

    // Run out-of-band so enqueue returns immediately (async-first).
    void (async () => {
      const r = this.jobs.get(id)!;
      r.status = "running";
      r.updatedAt = this.now();
      try {
        const result = await handler((p) => {
          r.progress = p;
          r.updatedAt = this.now();
        });
        r.status = "completed";
        (r as JobRecord<T>).result = result;
      } catch (e) {
        r.status = "failed";
        r.error = e instanceof Error ? e.message : "Job gagal.";
      }
      r.updatedAt = this.now();
    })();

    return { id };
  }

  async get(id: string): Promise<JobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  /** Test/await helper: resolve once the job settles (completed/failed). */
  async waitFor(id: string, pollMs = 1): Promise<JobRecord | null> {
    for (;;) {
      const r = this.jobs.get(id);
      if (r === undefined) return null;
      if (r.status === "completed" || r.status === "failed") return r;
      await new Promise((res) => setTimeout(res, pollMs));
    }
  }
}
