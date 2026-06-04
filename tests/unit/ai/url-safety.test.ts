import { describe, expect, it } from "vitest";
import { isHttpUrl } from "../../../src/lib/ai/url-safety";

describe("isHttpUrl (citation/source URL allowlist)", () => {
  it("accepts absolute http and https URLs", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects dangerous or non-clickable schemes and malformed values", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isHttpUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isHttpUrl("mailto:a@b.co")).toBe(false);
    expect(isHttpUrl("/relative/path")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
  });
});
