import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { OAuthError, OAuthService, verifyPkce } from "../../../src/server/oauth/oauth-service";

const challengeFor = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

function world(nowMs = () => 1000) {
  const svc = new OAuthService(nowMs);
  const client = svc.registerClient({ clientName: "Claude", redirectUris: ["https://claude.ai/callback"] });
  return { svc, client };
}

describe("OAuthService — registration", () => {
  it("registers a public client with a generated id", () => {
    const { client } = world();
    expect(client.clientId.startsWith("mcpc_")).toBe(true);
    expect(client.redirectUris).toEqual(["https://claude.ai/callback"]);
  });
  it("rejects invalid/empty redirect URIs", () => {
    const svc = new OAuthService();
    expect(() => svc.registerClient({ redirectUris: [] })).toThrow(OAuthError);
    expect(() => svc.registerClient({ redirectUris: ["ftp://x"] })).toThrow(OAuthError);
  });
  it("allows localhost http redirects (native clients)", () => {
    const svc = new OAuthService();
    expect(svc.registerClient({ redirectUris: ["http://localhost:9000/cb"] }).clientId).toBeDefined();
  });
});

describe("OAuthService — authorization-code + PKCE", () => {
  it("completes a valid S256 flow and resolves the user + scopes", () => {
    const { svc, client } = world();
    const verifier = "a".repeat(64);
    const code = svc.createAuthCode({
      clientId: client.clientId, userId: "u1", redirectUri: "https://claude.ai/callback",
      codeChallenge: challengeFor(verifier), scopes: ["read"],
    });
    const grant = svc.exchangeCode({ code, codeVerifier: verifier, redirectUri: "https://claude.ai/callback", clientId: client.clientId });
    expect(grant).toEqual({ userId: "u1", scopes: ["read"], clientName: "Claude" });
  });

  it("rejects a wrong PKCE verifier", () => {
    const { svc, client } = world();
    const code = svc.createAuthCode({ clientId: client.clientId, userId: "u1", redirectUri: "https://claude.ai/callback", codeChallenge: challengeFor("right") });
    expect(() => svc.exchangeCode({ code, codeVerifier: "wrong", redirectUri: "https://claude.ai/callback", clientId: client.clientId })).toThrow(/PKCE/i);
  });

  it("codes are single-use", () => {
    const { svc, client } = world();
    const v = "v".repeat(50);
    const code = svc.createAuthCode({ clientId: client.clientId, userId: "u1", redirectUri: "https://claude.ai/callback", codeChallenge: challengeFor(v) });
    svc.exchangeCode({ code, codeVerifier: v, redirectUri: "https://claude.ai/callback", clientId: client.clientId });
    expect(() => svc.exchangeCode({ code, codeVerifier: v, redirectUri: "https://claude.ai/callback", clientId: client.clientId })).toThrow(/tidak valid|dipakai/i);
  });

  it("rejects an expired code", () => {
    let t = 1000;
    const svc = new OAuthService(() => t);
    const client = svc.registerClient({ redirectUris: ["https://claude.ai/callback"] });
    const v = "verifier-string-long-enough";
    const code = svc.createAuthCode({ clientId: client.clientId, userId: "u1", redirectUri: "https://claude.ai/callback", codeChallenge: challengeFor(v) });
    t += 11 * 60 * 1000; // past the 10-min TTL
    expect(() => svc.exchangeCode({ code, codeVerifier: v, redirectUri: "https://claude.ai/callback", clientId: client.clientId })).toThrow(/kedaluwarsa/i);
  });

  it("rejects a redirect_uri mismatch on exchange", () => {
    const { svc, client } = world();
    const v = "v".repeat(50);
    const code = svc.createAuthCode({ clientId: client.clientId, userId: "u1", redirectUri: "https://claude.ai/callback", codeChallenge: challengeFor(v) });
    expect(() => svc.exchangeCode({ code, codeVerifier: v, redirectUri: "https://evil.example/cb", clientId: client.clientId })).toThrow(OAuthError);
  });

  it("requires PKCE (OAuth 2.1 — no plain code without challenge)", () => {
    const { svc, client } = world();
    expect(() => svc.createAuthCode({ clientId: client.clientId, userId: "u1", redirectUri: "https://claude.ai/callback", codeChallenge: "" })).toThrow(/PKCE/i);
  });
});

describe("verifyPkce", () => {
  it("supports S256 and plain", () => {
    expect(verifyPkce("abc", challengeFor("abc"), "S256")).toBe(true);
    expect(verifyPkce("abc", "abc", "plain")).toBe(true);
    expect(verifyPkce("abc", "xyz", "S256")).toBe(false);
  });
});
