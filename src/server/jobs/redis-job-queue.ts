// src/server/jobs/redis-job-queue.ts — Redis-backed job-state queue. PRD §10.3, §15.1.
// Activates when REDIS_URL is set. Job STATE (status/progress/result) lives in Redis so any app instance
// can read a job's progress (multi-instance friendly); the handler runs in-process. ioredis is dynamically
// imported so it never loads unless Redis is configured. Same JobQueue interface as the in-memory impl.
// (A full BullMQ worker-process model — separate consumer — is the next step for heavy fan-out.)

import type { JobHandler, JobQueue, JobRecord } from "./job-queue";

const TTL_SEC = 60 * 60 * 24; // keep job state for a day

interface RedisLike {
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
}

export class RedisJobQueue implements JobQueue {
  private redisPromise: Promise<RedisLike> | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly idGen: () => string,
    private readonly now: () => string,
  ) {}

  private async redis(): Promise<RedisLike> {
    if (this.redisPromise === null) {
      this.redisPromise = (async () => {
        const mod = await import("ioredis");
        const Redis = (mod as { default: new (url: string) => RedisLike }).default;
        return new Redis(this.redisUrl);
      })();
    }
    return this.redisPromise;
  }

  private key(id: string): string {
    return `agentbuff:job:${id}`;
  }
  private async write(rec: JobRecord): Promise<void> {
    const r = await this.redis();
    await r.set(this.key(rec.id), JSON.stringify(rec), "EX", TTL_SEC);
  }

  async enqueue<T>(handler: JobHandler<T>): Promise<{ id: string }> {
    const id = this.idGen();
    const rec: JobRecord<T> = { id, status: "queued", createdAt: this.now(), updatedAt: this.now() };
    await this.write(rec as JobRecord);

    void (async () => {
      rec.status = "running";
      rec.updatedAt = this.now();
      await this.write(rec as JobRecord);
      try {
        const result = await handler((p) => {
          rec.progress = p;
          rec.updatedAt = this.now();
          void this.write(rec as JobRecord);
        });
        rec.status = "completed";
        rec.result = result;
      } catch (e) {
        rec.status = "failed";
        rec.error = e instanceof Error ? e.message : "Job gagal.";
      }
      rec.updatedAt = this.now();
      await this.write(rec as JobRecord);
    })();

    return { id };
  }

  async get(id: string): Promise<JobRecord | null> {
    const r = await this.redis();
    const raw = await r.get(this.key(id));
    return raw === null ? null : (JSON.parse(raw) as JobRecord);
  }
}
