import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  fingerprint,
  LocalMasterKey,
} from "../../../src/lib/crypto/index";

const master = LocalMasterKey.generate();

describe("envelope encryption", () => {
  it("round-trips secrets (incl. empty and unicode)", async () => {
    for (const secret of ["AIza-some-byok-key-123", "", "kunci-🔑-rahasia", "sk-proj-abc.def"]) {
      expect(await decryptSecret(await encryptSecret(secret, master), master)).toBe(secret);
    }
  });

  it("produces a different ciphertext each time but always decrypts back", async () => {
    const a = await encryptSecret("same-secret", master);
    const b = await encryptSecret("same-secret", master);
    expect(a).not.toBe(b); // random DEK + IV
    expect(await decryptSecret(a, master)).toBe("same-secret");
    expect(await decryptSecret(b, master)).toBe("same-secret");
  });

  it("fails to decrypt with the wrong master key", async () => {
    const env = await encryptSecret("top-secret", master);
    await expect(decryptSecret(env, LocalMasterKey.generate())).rejects.toThrow();
  });

  it("rejects a tampered ciphertext (GCM auth)", async () => {
    const env = await encryptSecret("top-secret", master);
    const blob = JSON.parse(Buffer.from(env, "base64").toString("utf8")) as { data: string };
    blob.data = (blob.data[0] === "A" ? "B" : "A") + blob.data.slice(1);
    const tampered = Buffer.from(JSON.stringify(blob), "utf8").toString("base64");
    await expect(decryptSecret(tampered, master)).rejects.toThrow();
  });

  it("rejects a KEK of the wrong length", () => {
    expect(() => new LocalMasterKey(Buffer.alloc(16))).toThrow();
  });

  it("round-trips a base64-provided KEK", async () => {
    const b64 = master.getKek().toString("base64");
    const restored = LocalMasterKey.fromBase64(b64);
    expect(await decryptSecret(await encryptSecret("x", master), restored)).toBe("x");
  });

  it("dispatches on the envelope version and rejects an unknown one (back-compat guard)", async () => {
    // A current (v1) blob still decrypts...
    const env = await encryptSecret("byok-key", master);
    expect(JSON.parse(Buffer.from(env, "base64").toString("utf8")).v).toBe(1);
    expect(await decryptSecret(env, master)).toBe("byok-key");
    // ...but an unknown future version is refused with a clear error rather than mis-decoded.
    const blob = JSON.parse(Buffer.from(env, "base64").toString("utf8")) as { v: number };
    blob.v = 2;
    const v2 = Buffer.from(JSON.stringify(blob), "utf8").toString("base64");
    await expect(decryptSecret(v2, master)).rejects.toThrow(/version/i);
  });
});

describe("fingerprint", () => {
  it("is a stable 64-char hex digest that differs per input", () => {
    expect(fingerprint("abc")).toBe(fingerprint("abc"));
    expect(fingerprint("abc")).not.toBe(fingerprint("abd"));
    expect(fingerprint("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
