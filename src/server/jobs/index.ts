// src/server/jobs/index.ts — async job seam + backend factory. PRD §10.3.
// Redis-backed when REDIS_URL is set; in-memory otherwise (and always in tests).

export * from "./job-queue";
export { RedisJobQueue } from "./redis-job-queue";

import { InMemoryJobQueue, type JobQueue } from "./job-queue";
import { RedisJobQueue } from "./redis-job-queue";

export function createJobQueue(idGen: () => string, now: () => string): JobQueue {
  const url = process.env.REDIS_URL;
  if (process.env.NODE_ENV !== "test" && url !== undefined && url.length > 0) {
    return new RedisJobQueue(url, idGen, now);
  }
  return new InMemoryJobQueue(idGen, now);
}
