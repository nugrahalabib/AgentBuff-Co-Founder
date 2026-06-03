// src/lib/ai/credential-store.ts
// Read model for stored BYOK credentials. PRD §9.1.6 (ByokCredential). The secret is stored as
// envelope ciphertext (PRD §13.1) and only decrypted in-memory at call time by the ProviderRegistry.

import type { Capabilities, CredentialType, ProviderId } from "./types";

export interface StoredCredential {
  userId: string;
  provider: ProviderId;
  credType: CredentialType;
  /** Envelope-encrypted secret (see src/lib/crypto). Never the plaintext. */
  ciphertext: string;
  fingerprint: string;
  capabilities: Capabilities;
  isDefault: boolean;
  status: "active" | "invalid" | "revoked";
}

export interface CredentialStore {
  listForUser(userId: string): Promise<StoredCredential[]>;
}

/** A credential store that also supports linking/replacing a credential. */
export interface UpsertableCredentialStore extends CredentialStore {
  upsert(cred: StoredCredential): void | Promise<void>;
}

/** In-memory store for tests/dev; the Prisma-backed store implements the same interface. */
export class InMemoryCredentialStore implements UpsertableCredentialStore {
  private readonly creds: StoredCredential[];
  constructor(initial: StoredCredential[] = []) {
    this.creds = [...initial];
  }
  add(cred: StoredCredential): void {
    this.creds.push(cred);
  }
  /** Insert or replace the credential for a (userId, provider) pair. */
  upsert(cred: StoredCredential): void {
    const i = this.creds.findIndex((c) => c.userId === cred.userId && c.provider === cred.provider);
    if (i >= 0) this.creds[i] = cred;
    else this.creds.push(cred);
  }
  async listForUser(userId: string): Promise<StoredCredential[]> {
    return this.creds.filter((c) => c.userId === userId);
  }
}
