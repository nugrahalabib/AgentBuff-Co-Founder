// src/server/engine/brand/index.ts — deterministic brand palette engine. PRD §9.4.4.
export {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hexToHsl,
  hslToHex,
  rotateHue,
  withLightness,
  withSaturation,
  relativeLuminance,
  contrastText,
  type Rgb,
  type Hsl,
} from "./color";
export { generatePalette, normalizePrimary, type PaletteScheme, type BrandPalette } from "./palette";
