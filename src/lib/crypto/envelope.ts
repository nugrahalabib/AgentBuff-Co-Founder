// src/lib/crypto/envelope.ts
// BYOK secret protection via envelope encryption. PRD §13.1.
//   - A fresh random Data Encryption Key (DEK) encrypts each secret (AES-256-GCM).
//   - The Key-Encryption-Key (KEK / master key) wraps the DEK. In prod the KEK lives in KMS/Vault;
//     `MasterKeyProvider` is the seam so the rest of the app never sees raw key material.
//   - Plaintext secrets are decrypted in-memory ONLY at call time, NEVER logged or persisted.
//   - `fingerprint` lets us detect key change/duplication without storing the plaintext.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // 256-bit
const IV_LEN = 12; // 96-bit nonce (GCM standard)

export interface MasterKeyProvider {
  /** Return the 32-byte KEK. Implementations: KMS/Vault in prod, env-derived in dev. */
  getKek(): Buffer;
}

/** Dev/test KEK provider backed by an in-memory 32-byte key (e.g. from a base64 env var). */
export class LocalMasterKey implements MasterKeyProvider {
  constructor(private readonly kek: Buffer) {
    if (kek.length !== KEY_LEN) {
      throw new Error(`KEK must be exactly ${KEY_LEN} bytes (got ${kek.length}).`);
    }
  }
  static fromBase64(b64: string): LocalMasterKey {
    return new LocalMasterKey(Buffer.from(b64, "base64"));
  }
  /** Generate a fresh random KEK (for tests / first-time setup; persist it securely). */
  static generate(): LocalMasterKey {
    return new LocalMasterKey(randomBytes(KEY_LEN));
  }
  getKek(): Buffer {
    return this.kek;
  }
}

interface EnvelopeBlob {
  v: 1;
  wrappedDek: string;
  dekIv: string;
  dekTag: string;
  iv: string;
  tag: string;
  data: string;
}

function gcmEncrypt(key: Buffer, plaintext: Buffer): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function gcmDecrypt(key: Buffer, iv: Buffer, tag: Buffer, ciphertext: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

const fromB64 = (s: string): Buffer => Buffer.from(s, "base64");

/** Envelope-encrypt a secret → a single opaque base64 string suitable for `ByokCredential.ciphertext`. */
export function encryptSecret(plaintext: string, master: MasterKeyProvider): string {
  const dek = randomBytes(KEY_LEN);
  const data = gcmEncrypt(dek, Buffer.from(plaintext, "utf8"));
  const wrapped = gcmEncrypt(master.getKek(), dek);
  const blob: EnvelopeBlob = {
    v: 1,
    wrappedDek: wrapped.ciphertext.toString("base64"),
    dekIv: wrapped.iv.toString("base64"),
    dekTag: wrapped.tag.toString("base64"),
    iv: data.iv.toString("base64"),
    tag: data.tag.toString("base64"),
    data: data.ciphertext.toString("base64"),
  };
  return Buffer.from(JSON.stringify(blob), "utf8").toString("base64");
}

/** Reverse of {@link encryptSecret}. Throws if the KEK is wrong or the blob was tampered with (GCM auth). */
export function decryptSecret(envelope: string, master: MasterKeyProvider): string {
  const blob = JSON.parse(Buffer.from(envelope, "base64").toString("utf8")) as EnvelopeBlob;
  const dek = gcmDecrypt(master.getKek(), fromB64(blob.dekIv), fromB64(blob.dekTag), fromB64(blob.wrappedDek));
  const plaintext = gcmDecrypt(dek, fromB64(blob.iv), fromB64(blob.tag), fromB64(blob.data));
  return plaintext.toString("utf8");
}

/** Stable, non-reversible SHA-256 fingerprint of a secret (hex). Never store plaintext. PRD §13.1. */
export function fingerprint(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
