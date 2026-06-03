// src/server/storage/index.ts — object storage seam + backend factory. PRD §10.2.
// Auto-selects the backend the same way persistence auto-switches DB: S3 when configured, else durable
// local disk, and in-memory for tests. Callers depend only on the ObjectStorage interface.

export * from "./object-storage";
export { DiskObjectStorage } from "./disk-object-storage";
export { S3ObjectStorage, s3ConfigFromEnv, type S3Config } from "./s3-object-storage";

import { InMemoryObjectStorage, type ObjectStorage } from "./object-storage";
import { DiskObjectStorage } from "./disk-object-storage";
import { S3ObjectStorage, s3ConfigFromEnv } from "./s3-object-storage";

export function createObjectStorage(): ObjectStorage {
  if (process.env.NODE_ENV === "test") return new InMemoryObjectStorage();
  const s3 = s3ConfigFromEnv();
  if (s3 !== null) return new S3ObjectStorage(s3);
  return new DiskObjectStorage();
}
