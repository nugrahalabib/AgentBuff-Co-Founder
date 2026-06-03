import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCredentialStore, type StoredCredential } from "../../../src/lib/ai/credential-store";
import { CredentialService } from "../../../src/server/services/credential-service";
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
const noCaps: Capabilities = {
  groundedSearch: false,
  deepResearch: false,
  imageGen: false,
  vision: false,
  docUnderstanding: false,
  docAgentCli: false,
};

function cred(provider: ProviderId, secret: string, over: Partial<StoredCredential> = {}): StoredCredential {
  return {
    userId: "u1",
    provider,
    credType: "api_key",
    ciphertext: encryptSecret(secret, master),
    fingerprint: `fp-${provider}`,
    capabilities: allCaps,
    isDefault: false,
    status: "active",
    ...over,
  };
}

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}), text: async () => "" } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CredentialService.summary", () => {
  it("reports active state, default provider, and exposes no secrets", async () => {
    const store = new InMemoryCredentialStore([
      cred("gemini", "g", { isDefault: true }),
      cred("openai", "o", { status: "invalid" }),
    ]);
    const svc = new CredentialService(store, master);
    const s = await svc.summary("u1");

    expect(s.hasActive).toBe(true);
    expect(s.defaultProvider).toBe("gemini");
    expect(s.credentials).toHaveLength(2);
    // The view shape carries fingerprint + capabilities + status, never ciphertext/secret.
    expect(Object.keys(s.credentials[0]!)).not.toContain("ciphertext");
    expect(s.credentials[0]).toMatchObject({ provider: "gemini", fingerprint: "fp-gemini", isDefault: true });
  });

  it("has no active default when all credentials are invalid", async () => {
    const store = new InMemoryCredentialStore([cred("gemini", "g", { status: "invalid" })]);
    const s = await new CredentialService(store, master).summary("u1");
    expect(s.hasActive).toBe(false);
    expect(s.defaultProvider).toBeNull();
  });
});

describe("CredentialService.setDefault / remove", () => {
  it("setDefault makes one provider default and demotes the rest", async () => {
    const store = new InMemoryCredentialStore([
      cred("gemini", "g", { isDefault: true }),
      cred("openai", "o"),
    ]);
    const svc = new CredentialService(store, master);
    expect(await svc.setDefault("u1", "openai")).toBe(true);
    const s = await svc.summary("u1");
    expect(s.credentials.find((c) => c.provider === "openai")!.isDefault).toBe(true);
    expect(s.credentials.find((c) => c.provider === "gemini")!.isDefault).toBe(false);
  });

  it("remove unlinks a credential", async () => {
    const store = new InMemoryCredentialStore([cred("gemini", "g")]);
    const svc = new CredentialService(store, master);
    expect(await svc.remove("u1", "gemini")).toBe(true);
    expect((await svc.summary("u1")).credentials).toHaveLength(0);
    expect(await svc.remove("u1", "gemini")).toBe(false); // already gone
  });
});

describe("CredentialService.revalidate", () => {
  it("marks a rejected key invalid and refreshes capabilities for a live key", async () => {
    // Gemini probe → 401 (rejected → invalid). validateCredential returns ok:false with empty caps.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(401)));
    const store = new InMemoryCredentialStore([cred("gemini", "g", { isDefault: true })]);
    const svc = new CredentialService(store, master);
    const s = await svc.revalidate("u1");
    expect(s.credentials[0]!.status).toBe("invalid");
    expect(s.credentials[0]!.capabilities).toEqual(noCaps);
    expect(s.hasActive).toBe(false);
  });

  it("keeps the previous status on a transient provider outage (does not falsely invalidate)", async () => {
    // 503 → validateCredential throws a transient error → status must stay "active".
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(503)));
    const store = new InMemoryCredentialStore([cred("gemini", "g", { isDefault: true, status: "active" })]);
    const svc = new CredentialService(store, master);
    const s = await svc.revalidate("u1");
    expect(s.credentials[0]!.status).toBe("active");
  });
});
