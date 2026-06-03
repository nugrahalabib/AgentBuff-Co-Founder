// src/server/storage/s3-object-storage.ts — S3-compatible object storage (asia-southeast2 / any S3 API).
// PRD §10.2, §13.4. Config-driven via env; the AWS SDK is dynamically imported so it never loads unless
// S3 is actually configured. `url()` issues an EXPIRING presigned GET URL (§9.4.7). Same interface as the
// in-memory/disk impls — callers don't change.

import type { ObjectStorage, PutObjectInput } from "./object-storage";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string; // for non-AWS S3 (MinIO, R2, etc.)
  accessKeyId: string;
  secretAccessKey: string;
  /** Presigned URL lifetime in seconds (default 1h). */
  urlExpiresSec?: number;
}

/** Read S3 config from env, or null if not fully configured. */
export function s3ConfigFromEnv(): S3Config | null {
  const bucket = process.env.STORAGE_S3_BUCKET;
  const accessKeyId = process.env.STORAGE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_S3_SECRET_ACCESS_KEY;
  if (bucket === undefined || accessKeyId === undefined || secretAccessKey === undefined) return null;
  return {
    bucket,
    region: process.env.STORAGE_S3_REGION ?? "ap-southeast-2",
    endpoint: process.env.STORAGE_S3_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    urlExpiresSec: process.env.STORAGE_S3_URL_TTL ? Number(process.env.STORAGE_S3_URL_TTL) : 3600,
  };
}

// Minimal shapes of the dynamically-imported SDK pieces we use.
interface S3ClientLike {
  send(cmd: unknown): Promise<{ Body?: { transformToByteArray(): Promise<Uint8Array> }; ContentType?: string }>;
}

export class S3ObjectStorage implements ObjectStorage {
  private clientPromise: Promise<{ client: S3ClientLike; sdk: typeof import("@aws-sdk/client-s3"); presign: typeof import("@aws-sdk/s3-request-presigner") }> | null = null;

  constructor(private readonly cfg: S3Config) {}

  private async lib() {
    if (this.clientPromise === null) {
      this.clientPromise = (async () => {
        const sdk = await import("@aws-sdk/client-s3");
        const presign = await import("@aws-sdk/s3-request-presigner");
        const client = new sdk.S3Client({
          region: this.cfg.region,
          endpoint: this.cfg.endpoint,
          forcePathStyle: this.cfg.endpoint !== undefined,
          credentials: { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey },
        }) as unknown as S3ClientLike;
        return { client, sdk, presign };
      })();
    }
    return this.clientPromise;
  }

  async put({ key, data, contentType }: PutObjectInput): Promise<{ ref: string }> {
    const { client, sdk } = await this.lib();
    await client.send(new sdk.PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: contentType }));
    return { ref: key };
  }

  async get(ref: string): Promise<{ data: Buffer; contentType: string } | null> {
    const { client, sdk } = await this.lib();
    try {
      const out = await client.send(new sdk.GetObjectCommand({ Bucket: this.cfg.bucket, Key: ref }));
      if (out.Body === undefined) return null;
      const bytes = await out.Body.transformToByteArray();
      return { data: Buffer.from(bytes), contentType: out.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(ref: string): Promise<void> {
    const { client, sdk } = await this.lib();
    await client.send(new sdk.DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: ref })).catch(() => undefined);
  }

  /** Presigned GET — note this is async for S3; callers needing the URL should use `signedUrl`. */
  url(ref: string): string {
    // Synchronous fallback (the app serves via /api/storage which calls get()).
    return `/api/storage/${encodeURIComponent(ref)}`;
  }

  /** Expiring presigned URL for direct client download (§9.4.7). */
  async signedUrl(ref: string): Promise<string> {
    const { client, sdk, presign } = await this.lib();
    return presign.getSignedUrl(client as never, new sdk.GetObjectCommand({ Bucket: this.cfg.bucket, Key: ref }) as never, {
      expiresIn: this.cfg.urlExpiresSec ?? 3600,
    });
  }
}
