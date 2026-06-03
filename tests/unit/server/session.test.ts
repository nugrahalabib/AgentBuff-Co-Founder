import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  readUserIdFromCookieHeader,
  signSession,
  verifySession,
} from "../../../src/server/session";

describe("session signing", () => {
  it("round-trips a signed user id", () => {
    expect(verifySession(signSession("user-123"))).toBe("user-123");
  });

  it("rejects tampered, malformed, or missing tokens", () => {
    expect(verifySession("user-123.wrongsignature")).toBeNull();
    expect(verifySession("nodot")).toBeNull();
    expect(verifySession("user-123.")).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession(null)).toBeNull();
  });

  it("reads the user id out of a Cookie header", () => {
    const token = signSession("u1");
    expect(readUserIdFromCookieHeader(`foo=bar; ${SESSION_COOKIE}=${token}; baz=1`)).toBe("u1");
    expect(readUserIdFromCookieHeader(null)).toBeNull();
    expect(readUserIdFromCookieHeader("other=1")).toBeNull();
  });
});
