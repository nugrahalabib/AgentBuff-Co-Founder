import { describe, expect, it } from "vitest";
import {
  contrastText,
  generatePalette,
  hexToHsl,
  hexToRgb,
  hslToHex,
  normalizePrimary,
  relativeLuminance,
  rgbToHex,
  rotateHue,
  withLightness,
} from "../../../src/server/engine/brand/index";

describe("hex/rgb/hsl conversions", () => {
  it("parses 3- and 6-digit hex (with/without #) and rejects invalid → black", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("6366f1")).toEqual({ r: 99, g: 102, b: 241 });
    expect(hexToRgb("nope")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("rgbToHex clamps out-of-range channels", () => {
    expect(rgbToHex({ r: -10, g: 300, b: 128 })).toBe("#00ff80");
  });

  it("round-trips primary colours through HSL across all hue sectors", () => {
    for (const hex of ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"]) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it("greyscale has zero saturation (achromatic branch)", () => {
    expect(hexToHsl("#808080").s).toBe(0);
    expect(hslToHex({ h: 0, s: 0, l: 0.5 })).toBe("#808080");
  });

  it("rotateHue by 360 is a no-op; by 180 gives the complement", () => {
    expect(rotateHue("#ff0000", 360)).toBe("#ff0000");
    expect(rotateHue("#ff0000", 180)).toBe("#00ffff");
  });

  it("withLightness clamps and shifts lightness", () => {
    expect(withLightness("#6366f1", 2)).toBe("#ffffff"); // clamp high
    expect(withLightness("#6366f1", -1)).toBe("#000000"); // clamp low
  });
});

describe("luminance + contrast", () => {
  it("white is bright, black is dark", () => {
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(0.9);
    expect(relativeLuminance("#000000")).toBe(0);
  });
  it("picks readable text colour", () => {
    expect(contrastText("#ffffff")).toBe("#0b0b0f");
    expect(contrastText("#0b0b0f")).toBe("#ffffff");
  });
});

describe("generatePalette", () => {
  it("derives a coherent palette deterministically (complementary)", () => {
    const p = generatePalette("#6366f1", "complementary");
    expect(p.primary).toBe("#6366f1");
    expect(p).toHaveProperty("secondary");
    expect(p).toHaveProperty("accent");
    expect(p.onPrimary).toMatch(/^#(0b0b0f|ffffff)$/);
    // Same input → same output.
    expect(generatePalette("#6366f1", "complementary")).toEqual(p);
  });

  it("varies secondary by scheme", () => {
    const comp = generatePalette("#6366f1", "complementary").secondary;
    const ana = generatePalette("#6366f1", "analogous").secondary;
    const tri = generatePalette("#6366f1", "triadic").secondary;
    expect(new Set([comp, ana, tri]).size).toBe(3);
  });

  it("uppercases/handles hex without # and lowercases primary", () => {
    expect(generatePalette("6366F1").primary).toBe("#6366f1");
  });
});

describe("normalizePrimary", () => {
  it("accepts valid hex, adds #, and falls back on garbage", () => {
    expect(normalizePrimary("#abcdef")).toBe("#abcdef");
    expect(normalizePrimary("abcdef")).toBe("#abcdef");
    expect(normalizePrimary("xyz")).toBe("#6366f1");
    expect(normalizePrimary(undefined)).toBe("#6366f1");
  });
});
