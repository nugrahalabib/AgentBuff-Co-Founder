// src/server/engine/financial/growth.ts
// Monthly volume projection. Returns full-precision (possibly fractional) units —
// fractional units represent an average monthly sales rate. PRD §9.3.5.

import type { GrowthModel } from "./types";

/** Project sales volume for a 1-based month under the given growth model. */
export function projectUnits(initial: number, growth: GrowthModel, month: number): number {
  const t = month - 1;
  switch (growth.type) {
    case "linear":
      return initial * (1 + growth.ratePerMonth * t);
    case "compound":
      return initial * Math.pow(1 + growth.ratePerMonth, t);
    case "seasonal": {
      const base = initial * Math.pow(1 + growth.ratePerMonth, t);
      const indices = growth.seasonalIndices;
      // seasonalIndices is validated non-empty upstream, so the modulo index is always in range.
      const factor = indices[t % indices.length] as number;
      return base * factor;
    }
  }
}
