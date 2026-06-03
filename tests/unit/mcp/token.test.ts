import { describe, expect, it } from "vitest";
import { bearerFromHeader, generateToken, hashToken, hashesEqual } from "../../../src/server/mcp/token";

describe("MCP token", () => {
  it("generates a prefixed, high-entropy token whose hash matches", () => {
    const t = generateToken();
    expect(t.token.startsWith("mcp_")).toBe(true);
    expect(t.token.length).toBeGreaterThan(40);
    expect(t.hash).toBe(hashToken(t.token));
    expect(t.hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(t.display.endsWith("…")).toBe(true);
    expect(t.display.length).toBeLessThan(t.token.length); // prefix only
  });

  it("produces distinct tokens each call", () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });

  it("hashToken is deterministic", () => {
    expect(hashToken("mcp_abc")).toBe(hashToken("mcp_abc"));
    expect(hashToken("mcp_abc")).not.toBe(hashToken("mcp_abd"));
  });

  it("bearerFromHeader extracts the token, case-insensitively, or null", () => {
    expect(bearerFromHeader("Bearer mcp_xyz")).toBe("mcp_xyz");
    expect(bearerFromHeader("bearer  mcp_xyz ")).toBe("mcp_xyz");
    expect(bearerFromHeader("Basic abc")).toBeNull();
    expect(bearerFromHeader(null)).toBeNull();
  });

  it("hashesEqual compares constant-time and rejects mismatched lengths", () => {
    expect(hashesEqual("a".repeat(64), "a".repeat(64))).toBe(true);
    expect(hashesEqual("a".repeat(64), "b".repeat(64))).toBe(false);
    expect(hashesEqual("abc", "abcd")).toBe(false);
  });
});
