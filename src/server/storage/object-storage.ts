// src/server/storage/object-storage.ts — object storage seam. PRD §10.2, §13.4, §9.4.7 (expiring URLs).
// Large binary assets (brand images, rendered PDFs) live behind this interface so the app is identical
// whether storage is in-memory (dev/tests), local disk, or S3-compatible (asia-southeast2). The S3 impl
// is config-driven (S3_* env) and drops in without touching callers — matching the repository pattern.

export interface PutObjectInput {
  /** Caller-controlled, unique key (e.g. "brand/<kitId>/moodboard.png"). */
  key: string;
  data: Buffer;
  contentType: string;
}

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<{ ref: string }>;
  get(ref: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(ref: string): Promise<void>;
  /** A URL the browser can fetch the object from (served by /api/storage/[ref]). */
  url(ref: string): string;
}

/** Encode/decode a data URL (the bridge between adapter image output and storage). */
export function parseDataUrl(dataUrl: string): { data: Buffer; contentType: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (m === null) return null;
  return { contentType: m[1]!, data: Buffer.from(m[2]!, "base64") };
}

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly store = new Map<string, { data: Buffer; contentType: string }>();

  async put({ key, data, contentType }: PutObjectInput): Promise<{ ref: string }> {
    this.store.set(key, { data, contentType });
    return { ref: key };
  }
  async get(ref: string): Promise<{ data: Buffer; contentType: string } | null> {
    return this.store.get(ref) ?? null;
  }
  async delete(ref: string): Promise<void> {
    this.store.delete(ref);
  }
  url(ref: string): string {
    return `/api/storage/${encodeURIComponent(ref)}`;
  }
}
