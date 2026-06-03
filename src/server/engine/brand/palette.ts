// src/server/engine/brand/palette.ts — deterministic brand palette generation. PRD §9.4.4.
// Given a primary colour + harmony scheme (proposed by the LLM), derive a coherent palette of design
// tokens in code. Pure + deterministic → the same brand direction always yields the same tokens.

import { contrastText, rotateHue, withLightness, withSaturation } from "./color";

export type PaletteScheme = "complementary" | "analogous" | "triadic";

export interface BrandPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutralDark: string;
  neutralLight: string;
  surface: string;
  onPrimary: string;
  onAccent: string;
}

/** Hue offset of the secondary colour for each scheme. */
const SECONDARY_OFFSET: Record<PaletteScheme, number> = {
  complementary: 180,
  analogous: 30,
  triadic: 120,
};
/** Accent is a further rotation to add liveliness. */
const ACCENT_OFFSET: Record<PaletteScheme, number> = {
  complementary: 150,
  analogous: -30,
  triadic: 240,
};

export function generatePalette(primaryHex: string, scheme: PaletteScheme = "complementary"): BrandPalette {
  const secondary = rotateHue(primaryHex, SECONDARY_OFFSET[scheme]);
  const accent = withLightness(rotateHue(primaryHex, ACCENT_OFFSET[scheme]), 0.55);
  // Neutrals share a hint of the brand hue (warm/cool greys) at very low saturation.
  const neutralBase = withSaturation(primaryHex, 0.08);
  const neutralDark = withLightness(neutralBase, 0.14);
  const neutralLight = withLightness(neutralBase, 0.96);
  const surface = withLightness(neutralBase, 0.99);
  return {
    primary: primaryHex.startsWith("#") ? primaryHex.toLowerCase() : `#${primaryHex.toLowerCase()}`,
    secondary,
    accent,
    neutralDark,
    neutralLight,
    surface,
    onPrimary: contrastText(primaryHex),
    onAccent: contrastText(accent),
  };
}

/** Validate/normalize an LLM-proposed hex; fall back to a safe brand indigo if malformed. */
export function normalizePrimary(hex: string | undefined): string {
  const h = (hex ?? "").trim();
  return /^#?[0-9a-fA-F]{6}$/.test(h) ? (h.startsWith("#") ? h : `#${h}`) : "#6366f1";
}
