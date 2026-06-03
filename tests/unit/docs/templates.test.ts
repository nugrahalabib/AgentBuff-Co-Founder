import { describe, expect, it } from "vitest";
import { renderDocumentHtml } from "../../../src/server/docs/templates";
import type { BusinessDocument, BoundFinancials } from "../../../src/server/domain/types";

const bound: BoundFinancials = {
  contributionMarginPerUnit: 12000,
  grossMarginPct: 0.6,
  bepUnitsPerMonth: 417,
  startupCapital: 15_000_000,
  paybackMonths: 8,
  roiPct: 0.42,
};

function proposal(overrides?: Partial<Record<string, string>>): BusinessDocument {
  return {
    id: "d1", projectId: "p1", type: "proposal", status: "complete", version: 1,
    title: "Proposal — Kedai Kopi",
    slots: {
      tagline: overrides?.tagline ?? "Kopi terbaik",
      problem: "p", solution: "s", marketAnalysis: "m", businessModel: "bm",
      marketingPlan: "mp", team: "tm", financialHighlights: "fh", fundingAsk: "fa", closing: "c",
    },
    boundFinancials: bound,
    sources: [{ url: "https://contoh.id/riset", title: "Riset" }],
    theme: "indigo",
    stale: false,
    generatedAt: "t",
  };
}

describe("renderDocumentHtml — proposal", () => {
  it("produces a self-contained HTML doc with the title and bound numbers", () => {
    const html = renderDocumentHtml(proposal());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Proposal — Kedai Kopi");
    expect(html).toContain("15.000.000"); // startupCapital bound from the engine (id-ID grouping)
    expect(html).toContain("417 unit"); // BEP
    expect(html).toContain("@page"); // print pagination
  });

  it("HTML-escapes a malicious slot (no script injection)", () => {
    const html = renderDocumentHtml(proposal({ tagline: `<script>alert(document.cookie)</script>` }));
    expect(html).not.toContain("<script>alert(document.cookie)</script>");
    expect(html).toContain("&lt;script&gt;alert(document.cookie)&lt;/script&gt;");
  });

  it("renders clickable sources", () => {
    const html = renderDocumentHtml(proposal());
    expect(html).toContain("https://contoh.id/riset");
    expect(html).toContain("contoh.id");
  });
});

describe("renderDocumentHtml — pitch deck", () => {
  const deck: BusinessDocument = {
    id: "d2", projectId: "p1", type: "pitch_deck", status: "complete", version: 1,
    title: "Pitch Deck — Kedai Kopi",
    slots: { slides: [{ title: "Masalah", bullets: ["Antri lama", "<b>injeksi</b>"] }] },
    boundFinancials: bound,
    stale: false,
    generatedAt: "t",
  };

  it("renders slides 16:9 with escaped bullets + bound financial slide", () => {
    const html = renderDocumentHtml(deck);
    expect(html).toContain("1280px 720px"); // 16:9 page size
    expect(html).toContain("Masalah");
    expect(html).toContain("Antri lama");
    expect(html).toContain("&lt;b&gt;injeksi&lt;/b&gt;"); // escaped, not raw markup
    expect(html).toContain("15.000.000"); // financial slide bound
  });
});
