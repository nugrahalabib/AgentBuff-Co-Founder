// src/server/redis.ts — lazy ioredis singleton for cross-instance state (rate limiting, etc.).
// Returns null when REDIS_URL is unset (callers fall back to per-instance in-memory). ioredis is only
// loaded when actually configured, so it stays out of the default runtime. PRD §10.3, §13.2.
import "server-only";
import type { Redis } from "ioredis";

const g = globalThis as unknown as { __redisClient?: Redis | null };

export async function getRedis(): Promise<Redis | null> {
  if (g.__redisClient !== undefined) return g.__redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    g.__redisClient = null;
    return null;
  }
  const { default: IORedis } = await import("ioredis");
  g.__redisClient = new IORedis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  return g.__redisClient;
}
