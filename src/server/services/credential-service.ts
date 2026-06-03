// src/server/services/credential-service.ts
// BYOK credential health & management. PRD §9.1.4-6, §13.1. The secret never leaves this layer in
// plaintext: views expose only fingerprint + capabilities + status. Re-validation decrypts in-memory,
// probes the provider, and patches liveness — a transient outage does NOT mark a key invalid.

import { decryptSecret, type MasterKeyProvider } from "@/lib/crypto";
import { adapterFor } from "@/lib/ai/registry";
import type { UpsertableCredentialStore } from "@/lib/ai/credential-store";
import type { Capabilities, CredentialType, ProviderId } from "@/lib/ai/types";

export interface CredentialView {
  provider: ProviderId;
  credType: CredentialType;
  /** Non-reversible fingerprint of the secret (lets the user recognize which key is linked). */
  fingerprint: string;
  capabilities: Capabilities;
  isDefault: boolean;
  status: "active" | "invalid" | "revoked";
}

export interface CredentialSummary {
  hasActive: boolean;
  defaultProvider: ProviderId | null;
  credentials: CredentialView[];
}

export class CredentialService {
  constructor(
    private readonly store: UpsertableCredentialStore,
    private readonly master: MasterKeyProvider,
  ) {}

  async summary(userId: string): Promise<CredentialSummary> {
    const rows = await this.store.listForUser(userId);
    const credentials: CredentialView[] = rows.map((r) => ({
      provider: r.provider,
      credType: r.credType,
      fingerprint: r.fingerprint,
      capabilities: r.capabilities,
      isDefault: r.isDefault,
      status: r.status,
    }));
    const active = credentials.filter((c) => c.status === "active");
    const def = active.find((c) => c.isDefault) ?? active[0];
    return {
      hasActive: active.length > 0,
      defaultProvider: def?.provider ?? null,
      credentials,
    };
  }

  async remove(userId: string, provider: ProviderId): Promise<boolean> {
    return this.store.remove(userId, provider);
  }

  async setDefault(userId: string, provider: ProviderId): Promise<boolean> {
    return this.store.setDefault(userId, provider);
  }

  /**
   * Re-check each linked credential's liveness against the provider and patch status + capabilities.
   * Returns the refreshed summary. Transient failures are left untouched (not marked invalid).
   */
  async revalidate(userId: string): Promise<CredentialSummary> {
    const rows = await this.store.listForUser(userId);
    for (const row of rows) {
      const adapter = adapterFor(row.provider);
      let secret: string;
      try {
        secret = decryptSecret(row.ciphertext, this.master);
      } catch {
        await this.store.patchMeta(userId, row.provider, { status: "invalid" });
        continue;
      }
      try {
        const result = await adapter.validateCredential({ provider: row.provider, type: row.credType, secret });
        await this.store.patchMeta(userId, row.provider, {
          status: result.ok ? "active" : "invalid",
          capabilities: result.capabilities,
        });
      } catch {
        // Transient provider outage — keep the previous status; the user can retry later.
      }
    }
    return this.summary(userId);
  }
}
