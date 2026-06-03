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

/** Patchable subset of credential metadata (never the secret). */
export interface CredentialMetaPatch {
  status?: StoredCredential["status"];
  capabilities?: Capabilities;
}

/** A credential store that supports linking/replacing, removing, and managing credentials. */
export interface UpsertableCredentialStore extends CredentialStore {
  upsert(cred: StoredCredential): void | Promise<void>;
  /** Remove a (userId, provider) credential entirely. Returns true if one existed. */
  remove(userId: string, provider: ProviderId): boolean | Promise<boolean>;
  /** Make `provider` the user's default; clears the default flag on the others. */
  setDefault(userId: string, provider: ProviderId): boolean | Promise<boolean>;
  /** Patch non-secret metadata (e.g. after re-validating liveness). */
  patchMeta(userId: string, provider: ProviderId, patch: CredentialMetaPatch): boolean | Promise<boolean>;
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
  remove(userId: string, provider: ProviderId): boolean {
    const i = this.creds.findIndex((c) => c.userId === userId && c.provider === provider);
    if (i < 0) return false;
    this.creds.splice(i, 1);
    return true;
  }
  setDefault(userId: string, provider: ProviderId): boolean {
    let found = false;
    for (const c of this.creds) {
      if (c.userId !== userId) continue;
      c.isDefault = c.provider === provider;
      if (c.provider === provider) found = true;
    }
    return found;
  }
  patchMeta(userId: string, provider: ProviderId, patch: CredentialMetaPatch): boolean {
    const c = this.creds.find((x) => x.userId === userId && x.provider === provider);
    if (c === undefined) return false;
    if (patch.status !== undefined) c.status = patch.status;
    if (patch.capabilities !== undefined) c.capabilities = patch.capabilities;
    return true;
  }
  async listForUser(userId: string): Promise<StoredCredential[]> {
    return this.creds.filter((c) => c.userId === userId);
  }
  /** Remove all of a user's credentials (account erasure, §13.4). */
  clearUser(userId: string): void {
    for (let i = this.creds.length - 1; i >= 0; i--) {
      if (this.creds[i]!.userId === userId) this.creds.splice(i, 1);
    }
  }
}
