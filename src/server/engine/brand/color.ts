// src/server/engine/brand/color.ts — pure color math for deterministic brand palettes. PRD §9.4.4.
// The LLM proposes a primary colour + scheme; the CODE derives the coherent palette + contrast colours.
// Side-effect-free and deterministic.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Parse "#rgb" or "#rrggbb" (with/without #) into RGB. Invalid input → black. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

export const hexToHsl = (hex: string): Hsl => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl: Hsl): string => rgbToHex(hslToRgb(hsl));

/** Rotate the hue of a colour by `deg` degrees, preserving S/L. */
export function rotateHue(hex: string, deg: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: (((hsl.h + deg) % 360) + 360) % 360 });
}

/** Return a copy of the colour at the given lightness (0..1). */
export function withLightness(hex: string, l: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(l, 0, 1) });
}

/** Return a copy with saturation set to `s` (0..1). */
export function withSaturation(hex: string, s: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, s: clamp(s, 0, 1) });
}

/** WCAG relative luminance (0..1). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** Pick a readable text colour (near-black or white) for a given background. */
export function contrastText(hex: string): "#0b0b0f" | "#ffffff" {
  return relativeLuminance(hex) > 0.45 ? "#0b0b0f" : "#ffffff";
}
