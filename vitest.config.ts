import { defineConfig } from "vitest/config";

// The Financial Engine is the trust moat (PRD §9.3): it must hit 100% coverage.
// Coverage is scoped to the engine so its threshold is meaningful and enforced.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Deterministic engines are gated at 100%; the trust moat must stay fully covered.
      include: ["src/server/engine/financial/**/*.ts", "src/server/engine/research/**/*.ts"],
      // Pure type declarations carry no executable lines; barrels just re-export.
      exclude: ["**/types.ts", "**/index.ts"],
      thresholds: {
        100: true,
      },
    },
  },
});
