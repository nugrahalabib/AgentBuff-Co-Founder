import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  fingerprint,
  LocalMasterKey,
} from "../../../src/lib/crypto/index";

const master = LocalMasterKey.generate();

describe("envelope encryption", () => {
  it("round-trips secrets (incl. empty and unicode)", () => {
    for (const secret of ["AIza-some-byok-key-123", "", "kunci-🔑-rahasia", "sk-proj-abc.def"]) {
      expect(decryptSecret(encryptSecret(secret, master), master)).toBe(secret);
    }
  });

  it("produces a different ciphertext each time but always decrypts back", () => {
    const a = encryptSecret("same-secret", master);
    const b = encryptSecret("same-secret", master);
    expect(a).not.toBe(b); // random DEK + IV
    expect(decryptSecret(a, master)).toBe("same-secret");
    expect(decryptSecret(b, master)).toBe("same-secret");
  });

  it("fails to decrypt with the wrong master key", () => {
    const env = encryptSecret("top-secret", master);
    expect(() => decryptSecret(env, LocalMasterKey.generate())).toThrow();
  });

  it("rejects a tampered ciphertext (GCM auth)", () => {
    const env = encryptSecret("top-secret", master);
    const blob = JSON.parse(Buffer.from(env, "base64").toString("utf8")) as { data: string };
    blob.data = (blob.data[0] === "A" ? "B" : "A") + blob.data.slice(1);
    const tampered = Buffer.from(JSON.stringify(blob), "utf8").toString("base64");
    expect(() => decryptSecret(tampered, master)).toThrow();
  });

  it("rejects a KEK of the wrong length", () => {
    expect(() => new LocalMasterKey(Buffer.alloc(16))).toThrow();
  });

  it("round-trips a base64-provided KEK", () => {
    const b64 = master.getKek().toString("base64");
    const restored = LocalMasterKey.fromBase64(b64);
    expect(decryptSecret(encryptSecret("x", master), restored)).toBe("x");
  });
});

describe("fingerprint", () => {
  it("is a stable 64-char hex digest that differs per input", () => {
    expect(fingerprint("abc")).toBe(fingerprint("abc"));
    expect(fingerprint("abc")).not.toBe(fingerprint("abd"));
    expect(fingerprint("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
