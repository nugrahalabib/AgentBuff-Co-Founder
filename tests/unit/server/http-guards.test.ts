import { describe, expect, it } from "vitest";
import { clientIp, enforceBodyLimit, guardMutation, isSameOrigin, rateLimit } from "../../../src/server/http-guards";

/** Minimal Request stand-in (avoids the forbidden-header rules of the real Request/Headers). */
function fakeReq(headers: Record<string, string>): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (k: string) => lower[k.toLowerCase()] ?? null } } as unknown as Request;
}

describe("rateLimit (in-memory fallback when REDIS_URL unset)", () => {
  it("allows up to max within the window, then 429s", async () => {
    const key = "rl-unit-allow-then-block";
    expect(await rateLimit(key, 2, 60_000)).toBeNull();
    expect(await rateLimit(key, 2, 60_000)).toBeNull();
    const blocked = await rateLimit(key, 2, 60_000);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).not.toBeNull();
  });

  it("uses independent buckets per key", async () => {
    expect(await rateLimit("rl-unit-key-A", 1, 60_000)).toBeNull();
    expect(await rateLimit("rl-unit-key-B", 1, 60_000)).toBeNull(); // different key → not affected
  });
});

describe("enforceBodyLimit", () => {
  it("413s when Content-Length exceeds the cap, passes otherwise", () => {
    expect(enforceBodyLimit(fakeReq({ "content-length": "2000" }), 1000)?.status).toBe(413);
    expect(enforceBodyLimit(fakeReq({ "content-length": "500" }), 1000)).toBeNull();
    expect(enforceBodyLimit(fakeReq({}), 1000)).toBeNull(); // no header → can't tell → allow
  });
});

describe("isSameOrigin / guardMutation (CSRF)", () => {
  it("rejects a cross-origin request", () => {
    const cross = fakeReq({ origin: "http://evil.example", host: "localhost:1717" });
    expect(isSameOrigin(cross)).toBe(false);
    expect(guardMutation(cross)?.status).toBe(403);
  });

  it("accepts same-origin and Fetch-Metadata same-origin/none", () => {
    expect(isSameOrigin(fakeReq({ origin: "http://localhost:1717", host: "localhost:1717" }))).toBe(true);
    expect(guardMutation(fakeReq({ "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(guardMutation(fakeReq({ "sec-fetch-site": "none" }))).toBeNull();
  });
});

describe("clientIp", () => {
  it("reads the first X-Forwarded-For entry, then X-Real-IP, else unknown", () => {
    expect(clientIp(fakeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(fakeReq({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(fakeReq({}))).toBe("unknown");
  });
});
