import { describe, expect, it } from "vitest";
import { escapeHtml, escapeList, escapeMultiline, safeUrl, stripTags } from "../../../src/lib/html/sanitize";

describe("escapeHtml", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")&'</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;");
  });
  it("coerces null/undefined/numbers to a string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
  it("neutralizes an attribute-breakout attempt", () => {
    expect(escapeHtml(`" onmouseover="alert(1)`)).toBe("&quot; onmouseover=&quot;alert(1)");
  });
});

describe("escapeMultiline", () => {
  it("escapes then converts newlines to <br>", () => {
    expect(escapeMultiline("a<b>\nc")).toBe("a&lt;b&gt;<br>c");
    expect(escapeMultiline("x\r\ny")).toBe("x<br>y");
  });
});

describe("escapeList", () => {
  it("escapes every element", () => {
    expect(escapeList(["<a>", "b&c"])).toEqual(["&lt;a&gt;", "b&amp;c"]);
  });
});

describe("stripTags", () => {
  it("removes script/style blocks including their content", () => {
    expect(stripTags("hi<script>evil()</script> there")).toBe("hi there");
    expect(stripTags("a<style>.x{}</style>b")).toBe("ab");
  });
  it("removes stray tags and escapes the remainder", () => {
    expect(stripTags("<b>bold</b> & <i>x")).toBe("bold &amp; x");
  });
});

describe("safeUrl", () => {
  it("passes http(s) URLs (escaped) and blocks dangerous schemes", () => {
    expect(safeUrl("https://example.com/a?b=1&c=2")).toBe("https://example.com/a?b=1&amp;c=2");
    expect(safeUrl("http://x.id")).toBe("http://x.id");
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,<script>")).toBe("#");
    expect(safeUrl(undefined)).toBe("#");
  });
});
