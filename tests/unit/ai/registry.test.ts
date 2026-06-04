import { describe, expect, it } from "vitest";
import { InMemoryCredentialStore, type StoredCredential } from "../../../src/lib/ai/credential-store";
import { DefaultProviderRegistry, ProviderError } from "../../../src/lib/ai/registry";
import { encryptSecret, LocalMasterKey } from "../../../src/lib/crypto/index";
import type { Capabilities, ProviderId } from "../../../src/lib/ai/types";

const master = LocalMasterKey.generate();
const allCaps: Capabilities = {
  groundedSearch: true,
  deepResearch: true,
  imageGen: true,
  vision: true,
  docUnderstanding: true,
  docAgentCli: true,
};

async function cred(
  provider: ProviderId,
  secret: string,
  over: Partial<StoredCredential> = {},
): Promise<StoredCredential> {
  return {
    userId: "u1",
    provider,
    credType: "api_key",
    ciphertext: await encryptSecret(secret, master),
    fingerprint: "fp",
    capabilities: allCaps,
    isDefault: false,
    status: "active",
    ...over,
  };
}

describe("DefaultProviderRegistry.forTask", () => {
  it("uses the default provider for a task with no special capability, decrypting the secret", async () => {
    const store = new InMemoryCredentialStore(
      await Promise.all([cred("gemini", "gemini-key"), cred("openai", "openai-key", { isDefault: true })]),
    );
    const registry = new DefaultProviderRegistry(store, master);

    const { provider, cred: resolved } = await registry.forTask("u1", "reasoning_heavy");
    expect(provider.id).toBe("openai");
    expect(resolved.secret).toBe("openai-key"); // round-trips through envelope decryption
  });

  it("routes a capability-gated task to a provider that supports it, overriding the default", async () => {
    const store = new InMemoryCredentialStore(
      await Promise.all([
        cred("gemini", "gemini-key"), // imageGen true
        cred("openai", "openai-key", { isDefault: true, capabilities: { ...allCaps, imageGen: false } }),
      ]),
    );
    const registry = new DefaultProviderRegistry(store, master);

    const { provider } = await registry.forTask("u1", "image_gen");
    expect(provider.id).toBe("gemini"); // default OpenAI can't do images → fall back to Gemini
  });

  it("throws BYOK_KEY_MISSING when the user has no active credential", async () => {
    const store = new InMemoryCredentialStore(await Promise.all([cred("gemini", "g", { status: "revoked" })]));
    const registry = new DefaultProviderRegistry(store, master);
    await expect(registry.forTask("u1", "reasoning_heavy")).rejects.toMatchObject({
      code: "BYOK_KEY_MISSING",
    });
  });

  it("throws NO_PROVIDER_FOR_TASK when no linked provider has the capability", async () => {
    const store = new InMemoryCredentialStore(
      await Promise.all([
        cred("openai", "openai-key", { isDefault: true, capabilities: { ...allCaps, imageGen: false } }),
      ]),
    );
    const registry = new DefaultProviderRegistry(store, master);
    await expect(registry.forTask("u1", "image_gen")).rejects.toBeInstanceOf(ProviderError);
  });
});
