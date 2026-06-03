import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryDef } from "../../../src/ui/glossary";

describe("glossary", () => {
  it("has plain-Bahasa definitions for the core jargon (PRD §14.8)", () => {
    for (const key of ["hpp", "bep", "roi", "payback", "tam", "npv", "margin", "contribution-margin"]) {
      expect(GLOSSARY[key]).toBeDefined();
      expect(GLOSSARY[key]!.def.length).toBeGreaterThan(10);
    }
  });

  it("glossaryDef returns the entry or null", () => {
    expect(glossaryDef("hpp")?.label).toBe("HPP");
    expect(glossaryDef("nonexistent")).toBeNull();
  });
});
