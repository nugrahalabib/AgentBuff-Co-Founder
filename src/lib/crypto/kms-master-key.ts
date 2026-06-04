// src/lib/crypto/kms-master-key.ts
// Production KEK provider backed by AWS KMS (or any KMS-compatible endpoint via AWS_KMS_ENDPOINT).
//
// WHY: with LocalMasterKey the plaintext KEK sits in the app's env on the same box as the DB — so a full
// server compromise (root) yields KEK + ciphertext = decryptable BYOK keys. With KMS, only an ENCRYPTED
// KEK lives in config; the plaintext is produced by KMS at runtime (IAM-gated, audited, revocable) and
// cached in memory. A server/DB breach alone can no longer decrypt users' BYOK secrets. PRD §13.1.
//
// Setup (one-time): generate a random 32-byte KEK, encrypt it with your KMS key, store the base64
// ciphertext in BYOK_KEK_CIPHERTEXT_B64. See docs/PRODUCTION-SECURITY.md. Other KMS (GCP/Vault) = a sibling
// MasterKeyProvider implementing the same getKek() contract.
import "server-only";
import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";
import type { MasterKeyProvider } from "./envelope";

const KEY_LEN = 32;

export class KmsMasterKey implements MasterKeyProvider {
  private cached: Buffer | null = null;
  private inflight: Promise<Buffer> | null = null;

  constructor(
    private readonly keyId: string,
    private readonly encryptedKek: Buffer,
    private readonly region: string,
    private readonly endpoint?: string,
  ) {}

  /** Build from env, or null if KMS is not configured (callers then fall back to LocalMasterKey). */
  static fromEnv(): KmsMasterKey | null {
    const keyId = process.env.BYOK_KMS_KEY_ID;
    const ciphertextB64 = process.env.BYOK_KEK_CIPHERTEXT_B64;
    const region = process.env.BYOK_KMS_REGION ?? process.env.AWS_REGION ?? process.env.STORAGE_S3_REGION;
    if (!keyId || !ciphertextB64 || !region) return null;
    return new KmsMasterKey(keyId, Buffer.from(ciphertextB64, "base64"), region, process.env.AWS_KMS_ENDPOINT);
  }

  /** Decrypt the KEK via KMS once (deduped), then serve the cached plaintext for the process lifetime. */
  async getKek(): Promise<Buffer> {
    if (this.cached !== null) return this.cached;
    if (this.inflight !== null) return this.inflight;
    this.inflight = (async () => {
      const client = new KMSClient({ region: this.region, ...(this.endpoint ? { endpoint: this.endpoint } : {}) });
      const out = await client.send(new DecryptCommand({ KeyId: this.keyId, CiphertextBlob: this.encryptedKek }));
      if (out.Plaintext === undefined) throw new Error("KMS Decrypt returned no plaintext for the BYOK KEK.");
      const kek = Buffer.from(out.Plaintext);
      if (kek.length !== KEY_LEN) throw new Error(`Decrypted BYOK KEK must be ${KEY_LEN} bytes (got ${kek.length}).`);
      this.cached = kek;
      this.inflight = null;
      return kek;
    })();
    return this.inflight;
  }
}
