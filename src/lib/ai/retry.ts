// src/lib/ai/retry.ts — exponential backoff for transient provider errors (429 / 5xx / network). PRD §12.5.

export interface RetryOpts {
  retries?: number;
  baseMs?: number;
  isTransient?: (e: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Errors carrying a truthy `transient` flag (GeminiApiError / OpenAIApiError) are retryable. */
export function isTransientError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { transient?: boolean }).transient === true;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 400;
  const isTransient = opts.isTransient ?? isTransientError;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries || !isTransient(e)) throw e;
      await sleep(baseMs * 2 ** attempt); // 400ms, 800ms, 1600ms, …
    }
  }
  throw lastErr;
}
