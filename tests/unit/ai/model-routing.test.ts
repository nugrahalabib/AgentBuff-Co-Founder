import { afterEach, describe, expect, it } from "vitest";
import { providerOfModel, resolveModel } from "../../../src/lib/ai/model-routing";

afterEach(() => {
  delete process.env["MODEL_IMAGE_GEN_GEMINI"];
  delete process.env["MODEL_REASONING_HEAVY_OPENAI"];
});

describe("resolveModel", () => {
  it("returns the configured default when no override is set", () => {
    expect(resolveModel("image_gen", "gemini")).toBe("gemini-3-pro-image-preview");
    expect(resolveModel("reasoning_heavy", "openai")).toBe("gpt-5.2");
  });

  it("an env override wins over the default (no code change needed to fix a model id)", () => {
    process.env["MODEL_IMAGE_GEN_GEMINI"] = "gemini-9-ultra-image";
    expect(resolveModel("image_gen", "gemini")).toBe("gemini-9-ultra-image");
  });

  it("an empty override is ignored (falls back to default)", () => {
    process.env["MODEL_REASONING_HEAVY_OPENAI"] = "";
    expect(resolveModel("reasoning_heavy", "openai")).toBe("gpt-5.2");
  });
});

describe("providerOfModel", () => {
  it("reverse-maps a known default model to its provider", () => {
    expect(providerOfModel("gpt-5-mini")).toBe("openai");
    expect(providerOfModel("gemini-3-pro-image-preview")).toBe("gemini");
    expect(providerOfModel("totally-unknown")).toBe("unknown");
    expect(providerOfModel(undefined)).toBe("unknown");
  });
});
