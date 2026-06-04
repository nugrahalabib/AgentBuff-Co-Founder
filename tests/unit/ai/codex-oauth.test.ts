import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bundleFromAccessToken,
  buildAuthorizeUrl,
  decodeAccountInfo,
  generatePkce,
  generateState,
  needsRefresh,
  parseBundle,
  serializeBundle,
  type CodexTokenBundle,
} from "../../../src/lib/ai/codex-oauth";
import { CODEX_OAUTH, CODEX_REFRESH_LEAD_MS } from "../../../src/lib/ai/codex-config";

function base64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Hand-craft an unsigned JWT carrying the OpenAI account claims. */
function fakeJwt(payload: Record<string, unknown>): string {
  return `${base64url(JSON.stringify({ alg: "none" }))}.${base64url(JSON.stringify(payload))}.sig`;
}

describe("PKCE (S256)", () => {
  it("derives the challenge as base64url(sha256(verifier))", () => {
    const { verifier, challenge } = generatePkce();
    const expected = createHash("sha256").update(verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(challenge).toBe(expected);
    expect(verifier).not.toContain("=");
    expect(verifier).not.toContain("+");
  });

  it("generates distinct state values", () => {
    expect(generateState()).not.toBe(generateState());
  });
});

describe("buildAuthorizeUrl", () => {
  const url = buildAuthorizeUrl({ challenge: "CHAL", state: "ST" });

  it("targets the Codex authorize endpoint with the public client + S256", () => {
    expect(url.startsWith(`${CODEX_OAUTH.authorizeUrl}?`)).toBe(true);
    expect(url).toContain(`client_id=${CODEX_OAUTH.clientId}`);
    expect(url).toContain("code_challenge=CHAL");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("state=ST");
  });

  it("encodes the scope spaces as %20 (never '+')", () => {
    expect(url).toContain("scope=openid%20profile%20email%20offline_access");
    expect(url).not.toContain("scope=openid+profile");
  });

  it("encodes the fixed loopback redirect_uri and the codex extra params", () => {
    expect(url).toContain(`redirect_uri=${encodeURIComponent(CODEX_OAUTH.redirectUri)}`);
    expect(url).toContain("id_token_add_organizations=true");
    expect(url).toContain("codex_cli_simplified_flow=true");
    expect(url).toContain("originator=codex_cli_rs");
  });
});

describe("decodeAccountInfo", () => {
  it("reads chatgpt_account_id, plan, and email from the OpenAI claim namespaces", () => {
    const token = fakeJwt({
      exp: 1893456000,
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_123", chatgpt_plan_type: "plus" },
      "https://api.openai.com/profile": { email: "user@example.com" },
    });
    expect(decodeAccountInfo(token)).toEqual({
      chatgptAccountId: "acct_123",
      chatgptPlanType: "plus",
      email: "user@example.com",
      exp: 1893456000,
    });
  });

  it("returns empty fields for a non-JWT", () => {
    expect(decodeAccountInfo("not-a-jwt")).toEqual({});
  });
});

describe("token bundle (de)serialization", () => {
  it("round-trips", () => {
    const bundle: CodexTokenBundle = {
      accessToken: "at",
      refreshToken: "rt",
      chatgptAccountId: "acct_1",
      chatgptPlanType: "pro",
      email: "a@b.co",
      expiresAt: 1234,
    };
    expect(parseBundle(serializeBundle(bundle))).toEqual(bundle);
  });

  it("rejects a corrupt bundle (no access token)", () => {
    expect(() => parseBundle(JSON.stringify({ refreshToken: "x" }))).toThrow();
  });

  it("builds a refresh-less bundle from a pasted access-token JWT", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = fakeJwt({ exp, "https://api.openai.com/auth": { chatgpt_account_id: "acct_9" } });
    const b = bundleFromAccessToken(token);
    expect(b.accessToken).toBe(token);
    expect(b.refreshToken).toBeUndefined();
    expect(b.chatgptAccountId).toBe("acct_9");
    expect(b.expiresAt).toBe(exp * 1000);
  });
});

describe("needsRefresh (proactive 5-day lead)", () => {
  const now = 1_000_000_000_000;
  it("is true within the lead window", () => {
    expect(needsRefresh({ accessToken: "a", expiresAt: now + CODEX_REFRESH_LEAD_MS - 1 }, now)).toBe(true);
  });
  it("is false well before the lead window", () => {
    expect(needsRefresh({ accessToken: "a", expiresAt: now + CODEX_REFRESH_LEAD_MS + 60_000 }, now)).toBe(false);
  });
  it("is true for an already-expired token", () => {
    expect(needsRefresh({ accessToken: "a", expiresAt: now - 1 }, now)).toBe(true);
  });
});
