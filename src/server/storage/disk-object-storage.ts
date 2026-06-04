// src/server/storage/disk-object-storage.ts — persistent local-disk object storage. PRD §10.2.
// Real and durable (survives restarts) with ZERO external services — the sensible default for a single
// VPS. Objects are addressed by a hash of the key (no path traversal); content type is kept in a sidecar.
// S3 drops in for multi-node later (s3-object-storage.ts) behind the same ObjectStorage interface.

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ObjectStorage, PutObjectInput, StoredObject } from "./object-storage";

export class DiskObjectStorage implements ObjectStorage {
  private readonly baseDir: string;
  private ensured = false;

  constructor(baseDir?: string) {
    this.baseDir = resolve(baseDir ?? process.env.STORAGE_DIR ?? join(process.cwd(), ".data", "storage"));
  }

  /** Deterministic, traversal-safe ref derived from the caller's key. */
  private refFor(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }
  private async ensureDir(): Promise<void> {
    if (this.ensured) return;
    await mkdir(this.baseDir, { recursive: true });
    this.ensured = true;
  }

  async put({ key, data, contentType, ownerUserId }: PutObjectInput): Promise<{ ref: string }> {
    await this.ensureDir();
    const ref = this.refFor(key);
    await writeFile(join(this.baseDir, ref), data);
    await writeFile(join(this.baseDir, `${ref}.type`), contentType, "utf8");
    await writeFile(join(this.baseDir, `${ref}.owner`), ownerUserId ?? "", "utf8");
    return { ref };
  }

  async get(ref: string): Promise<StoredObject | null> {
    // ref is a 64-char hex hash; reject anything else to prevent path games.
    if (!/^[0-9a-f]{64}$/.test(ref)) return null;
    try {
      const data = await readFile(join(this.baseDir, ref));
      const contentType = await readFile(join(this.baseDir, `${ref}.type`), "utf8").catch(() => "application/octet-stream");
      const owner = await readFile(join(this.baseDir, `${ref}.owner`), "utf8").catch(() => "");
      return { data, contentType, ownerUserId: owner === "" ? undefined : owner };
    } catch {
      return null;
    }
  }

  async delete(ref: string): Promise<void> {
    if (!/^[0-9a-f]{64}$/.test(ref)) return;
    await rm(join(this.baseDir, ref), { force: true });
    await rm(join(this.baseDir, `${ref}.type`), { force: true });
    await rm(join(this.baseDir, `${ref}.owner`), { force: true });
  }

  url(ref: string): string {
    return `/api/storage/${encodeURIComponent(ref)}`;
  }
}
